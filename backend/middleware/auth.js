import jwt from 'jsonwebtoken'
import User from '../models/user.js'
import Role from '../models/Role.js'
import RolePermission from '../models/RolePermission.js'
import UserPermission from '../models/UserPermission.js'
import Permission from '../models/Permissions.js'
import { Op } from 'sequelize'

export const protect = async (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1]
    if (!token) return res.status(401).json({ message: 'No token provided' })
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        const user = await User.findByPk(decoded.id, {
            attributes: { exclude: ['password'] },
        })

        if (!user) {
            return res.status(401).json({ message: 'User not found' })
        }

        const roleId = user.role_id || null
        const roleDoc = roleId ? await Role.findByPk(roleId) : null
        const [rolePermDocs, userPermDocs] = await Promise.all([
            roleId
                ? RolePermission.findAll({
                    where: { role_id: roleId },
                    attributes: ["permission_id"],
                    raw: true,
                })
                : [],
            UserPermission.findAll({
                where: { user_id: user.id },
                attributes: ["permission_id"],
                raw: true,
            }),
        ])

        const permissionIds = [...new Set([
            ...rolePermDocs.map((rp) => rp.permission_id),
            ...userPermDocs.map((up) => up.permission_id),
        ].filter(Boolean))]

        const permissionDocs = permissionIds.length
            ? await Permission.findAll({
                where: { id: { [Op.in]: permissionIds } },
                attributes: ["permission"],
                raw: true,
            })
            : []

        const permissionSet = new Set(permissionDocs.map((p) => p.permission).filter(Boolean))

        const plainUser = user.get({ plain: true })
        req.user = {
            ...plainUser,
            role: roleDoc ? roleDoc.get({ plain: true }) : null,
            role_id: roleDoc?.id || plainUser.role_id || null,
            permissions: Array.from(permissionSet),
        }
        next()
    } catch (error) {
        res.status(401).json({ message: 'Invalid or Expired Token' })
    }
}

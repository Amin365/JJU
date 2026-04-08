import jwt from 'jsonwebtoken'
import User from '../models/user.js'
import Role from '../models/Role.js'
import RolePermission from '../models/RolePermission.js'
import UserPermission from '../models/UserPermission.js'
import Permission from '../models/Permissions.js'

export const protect = async (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1]
    if (!token) return res.status(401).json({ message: 'No token provided' })
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        const user = await User.findByPk(decoded.id, {
            attributes: { exclude: ['password'] },
            include: [{ model: Role, as: 'roleInfo' }],
        })

        if (!user) {
            return res.status(401).json({ message: 'User not found' })
        }

        const roleId = user.roleInfo?.id || user.role_id
        const [rolePermDocs, userPermDocs] = await Promise.all([
            roleId
                ? RolePermission.findAll({
                    where: { role_id: roleId },
                    include: [{ model: Permission, as: 'permission' }],
                })
                : [],
            UserPermission.findAll({
                where: { user_id: user.id },
                include: [{ model: Permission, as: 'permission' }],
            }),
        ])

        const permissionSet = new Set()
        rolePermDocs.forEach((rp) => {
            if (rp.permission?.permission) permissionSet.add(rp.permission.permission)
        })
        userPermDocs.forEach((up) => {
            if (up.permission?.permission) permissionSet.add(up.permission.permission)
        })

        const plainUser = user.get({ plain: true })
        req.user = {
            ...plainUser,
            role: plainUser.roleInfo,
            permissions: Array.from(permissionSet),
        }
        next()
    } catch (error) {
        res.status(401).json({ message: 'Invalid or Expired Token' })
    }
}

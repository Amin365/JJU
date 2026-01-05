import Role from "../models/Role.js";

export async function createRole(req, res) {
  try {
    const { role, permissions } = req.body;
    const newRole = new Role({ role, permissions });
    const savedRole = await newRole.save();
    res.status(201).json(savedRole);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
}

export async function getRoles(req, res) {
  try {
    const roles = await Role.find().lean().exec();
    res.status(200).json(roles);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
}




export const requireRole = (roles = []) => (req, res, next) => {
  const roleName = req.user?.role?.role || req.user?.role;
  if (!req.user || !roles.includes(roleName)) {
    return res.status(403).json({ message: "Access denied" });
  }
  return next();
};

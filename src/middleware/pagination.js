module.exports = (req, res, next) => {
  let page = parseInt(req.query.page) || 1;
  let limit = parseInt(req.query.limit) || 20;
  if (page < 1) page = 1;
  if (limit < 1) limit = 1;
  if (limit > 100) limit = 100;
  req.pagination = { page, limit, skip: (page - 1) * limit };
  next();
};

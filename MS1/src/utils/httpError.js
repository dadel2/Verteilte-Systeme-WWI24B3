function sendError(res, statusCode, message) {
  res.set("X-Fehlermeldung", message);
  return res.status(statusCode).json({ error: message });
}

module.exports = { sendError };

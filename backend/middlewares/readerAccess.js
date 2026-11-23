import { optionalAuth } from "./ensureAuth.js";
import { readerContext } from "../services/matureAccess.js";
export default function readerAccess(req, res, next) {
  if (readerContext.getStore()) return next();
  if (req.user) return readerContext.run(req.user, next);
  optionalAuth(req, res, err => {
    if (err) return next(err);
    readerContext.run(req.user || {}, next);
  });
}

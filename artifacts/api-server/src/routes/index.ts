import { Router, type IRouter } from "express";
import healthRouter from "./health";
import storageRouter from "./storage";
import syncRouter from "./sync";

const router: IRouter = Router();

router.use(healthRouter);
router.use(storageRouter);
router.use(syncRouter);

export default router;

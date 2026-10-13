import { Router, type IRouter } from "express";
import healthRouter from "./health";
import storageRouter from "./storage";
import altrixRouter from "./altrix";

const router: IRouter = Router();

router.use(healthRouter);
router.use(storageRouter);
router.use(altrixRouter);

export default router;

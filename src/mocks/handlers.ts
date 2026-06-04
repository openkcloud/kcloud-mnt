import { http, HttpResponse } from "msw";
import { acceleratorHandlers } from "./handlers/accelerators";
import { iaasHandlers } from "./handlers/iaas";
import { paasHandlers } from "./handlers/paas";
import { kubeflowHandlers } from "./handlers/kubeflow";
import { dashboardHandlers } from "./handlers/dashboard";
import { resourceMapHandlers } from "./handlers/resource-map";
import { infrastructureHandlers } from "./handlers/infrastructure";

export const handlers = [
  ...dashboardHandlers,
  ...acceleratorHandlers,
  ...iaasHandlers,
  ...paasHandlers,
  ...kubeflowHandlers,
  ...resourceMapHandlers,
  ...infrastructureHandlers,
  // catch-all for /api/*
  http.get("/api/health", () => HttpResponse.json({ status: "ok", env: "mock" })),
];

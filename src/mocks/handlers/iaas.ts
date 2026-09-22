import { http, HttpResponse, delay } from "msw";
import {
  centers,
  zones,
  networks,
  pools,
  tenants,
  vms,
  volumes,
  images,
  iaasNetworks,
  resourceRequests,
} from "../fixtures";

export const iaasHandlers = [
  http.get("/api/iaas/centers", async () => {
    await delay(80);
    return HttpResponse.json({ items: centers });
  }),
  http.get("/api/iaas/zones", async () => {
    await delay(80);
    return HttpResponse.json({ items: zones });
  }),
  http.get("/api/iaas/networks-base", async () => {
    await delay(80);
    return HttpResponse.json({ items: networks });
  }),
  http.get("/api/iaas/pools", async () => {
    await delay(80);
    return HttpResponse.json({ items: pools });
  }),
  http.get("/api/iaas/projects", async () => {
    await delay(100);
    return HttpResponse.json({ items: tenants });
  }),
  http.get("/api/iaas/instances", async ({ request }) => {
    await delay(120);
    const url = new URL(request.url);
    const tenantId = url.searchParams.get("tenantId");
    const status = url.searchParams.get("status");
    let items = [...vms];
    if (tenantId && tenantId !== "all") items = items.filter((v) => v.tenantId === tenantId);
    if (status && status !== "all") items = items.filter((v) => v.status === status);
    return HttpResponse.json({ items, total: items.length });
  }),
  http.get("/api/iaas/volumes", async () => {
    await delay(100);
    return HttpResponse.json({ items: volumes });
  }),
  http.get("/api/iaas/images", async () => {
    await delay(80);
    return HttpResponse.json({ items: images });
  }),
  http.get("/api/iaas/networks", async () => {
    await delay(80);
    return HttpResponse.json({ items: iaasNetworks });
  }),
  http.get("/api/iaas/requests", async ({ request }) => {
    await delay(120);
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const type = url.searchParams.get("type");
    const requestedBy = url.searchParams.get("requestedBy");
    let items = [...resourceRequests];
    if (status && status !== "all") items = items.filter((r) => r.status === status);
    if (type && type !== "all") items = items.filter((r) => r.type === type);
    if (requestedBy) items = items.filter((r) => r.requestedBy === requestedBy);
    return HttpResponse.json({ items, total: items.length });
  }),
  http.post("/api/iaas/requests", async ({ request }) => {
    await delay(300);
    const body = (await request.json()) as Record<string, unknown>;
    const newReq = {
      id: `req-${Date.now()}`,
      type: "vm",
      status: "pending",
      requestedAt: new Date().toISOString(),
      ...body,
    } as (typeof resourceRequests)[number];
    resourceRequests.unshift(newReq);
    return HttpResponse.json(newReq, { status: 201 });
  }),
  http.patch("/api/iaas/requests/:id", async ({ params, request }) => {
    await delay(400);
    const body = await request.json() as { action: "approve" | "reject"; reason?: string };
    // 승인/반려 시 목업 상태 반영
    const req = resourceRequests.find((r) => r.id === params.id);
    if (req) req.status = body.action === "approve" ? "provisioning" : "rejected";
    return HttpResponse.json({ success: true, id: params.id, action: body.action });
  }),
];

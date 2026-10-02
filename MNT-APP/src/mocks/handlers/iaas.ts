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
];

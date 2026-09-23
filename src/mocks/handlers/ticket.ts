import { http, HttpResponse, delay } from "msw";
import { resourceRequests } from "../fixtures";

// 자원 신청(티켓) — VM·서비스 클러스터 공통. 유형은 type("vm" | "cluster")으로 구분한다.
export const ticketHandlers = [
  http.get("/api/ticket/requests", async ({ request }) => {
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
  http.post("/api/ticket/requests", async ({ request }) => {
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
  http.patch("/api/ticket/requests/:id", async ({ params, request }) => {
    await delay(400);
    const body = await request.json() as { action: "approve" | "reject"; reason?: string };
    // 승인/반려 시 목업 상태 반영
    const req = resourceRequests.find((r) => r.id === params.id);
    if (req) req.status = body.action === "approve" ? "provisioning" : "rejected";
    return HttpResponse.json({ success: true, id: params.id, action: body.action });
  }),
];

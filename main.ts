import { Hono } from "https://deno.land/x/hono@v3.11.7/mod.ts"
import { serveStatic } from "https://deno.land/x/hono@v3.11.7/middleware.ts"
import { streamSSE } from "https://deno.land/x/hono@v3.11.7/helper/streaming/index.ts"
const db = await Deno.openKv()
const app = new Hono()
let i = 0
interface BodyVisitRequest {
  country: string
  city: string
  flag: string
}
app.get("/", (c) => c.text("Hello Deno!"))

app.get("/index.html", serveStatic({ path: "/index.html" }))

app.get("/counter", (c) => {
  return streamSSE(c, async (stream) => {
    const visitsKey = ["visits"]
    const lastVisitKey = ["lastVisit"]
    const watcher = db.watch([visitsKey, lastVisitKey])
    for await (const entry of watcher) {
      const { value: visits } = entry[0]
      const { value: lastVisit }: any = entry[1]
      const lastVisitInfo: BodyVisitRequest = {
        country: lastVisit.country,
        city: lastVisit.city,
        flag: lastVisit.flag
      }
      if (visits != null && lastVisitInfo != null) {
        const message = `Ultima visita desde ${lastVisitInfo.city}, ${lastVisitInfo.country} ${lastVisitInfo.flag}`
        await stream.writeSSE({
          data: message,
          event: "update",
          id: String(i++)
        })
      }
    }
  })
})
app.post("/saveNewVisit", async (c) => {
  const { country, city, flag } = await c.req.json<BodyVisitRequest>()
  await db
    .atomic()
    .set(["lastVisit"], { country, city, flag })
    .sum(["visits"], 1n)
    .commit()

  return c.json({ ok: true })
})

Deno.serve(app.fetch)

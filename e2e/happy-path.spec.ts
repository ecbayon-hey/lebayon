import { expect, test } from "@playwright/test";
const events=[
 {type:"conversation_started"},{type:"text_delta",delta:"Here is the result.\n\n```mermaid\ngraph TD; A-->B\n```"},
 {type:"tool_started",tool:"search_web",label:"Searching the wider web…"},
 {type:"source",source:{type:"klarna",title:"Official guide",heading:"Sessions",url:"https://docs.klarna.com/example"}},
 {type:"source",source:{type:"web",title:"Example research",url:"https://example.com/research"}},
 {type:"chart",chart:{type:"bar",title:"Volume",labels:["Jan","Feb"],series:[{name:"Requests",data:[2,4]}]}},
 {type:"image",url:"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E",alt:"Generated sample"},
 {type:"tool_finished",tool:"search_web"},{type:"summary_update",summary:"User saw happy path"},{type:"done"},
];
test.beforeEach(async({page})=>{await page.route("**/api/chat",route=>route.fulfill({status:200,contentType:"text/event-stream",body:events.map(e=>`data: ${JSON.stringify(e)}\n\n`).join("")}));await page.goto("/")});
test("complete chat, streaming, citations and artifact happy path",async({page})=>{await page.getByLabel("Message LeBayon").fill("Show everything");await page.getByLabel("Send message").click();await expect(page.getByText("Here is the result.")).toBeVisible();await expect(page.getByLabel("Sources").getByRole("link")).toHaveCount(2);await expect(page.getByText("Volume")).toBeVisible();await expect(page.getByAltText("Generated sample")).toBeVisible();await expect(page.getByLabel("Diagram").locator("svg")).toBeVisible()});
test("theme survives reload and New chat clears the session",async({page})=>{await page.getByLabel("Use dark theme").click();await page.reload();await expect(page.locator("html")).toHaveAttribute("data-theme","dark");await page.getByLabel("Message LeBayon").fill("hello");await page.getByLabel("Send message").click();await expect(page.getByText("Here is the result.")).toBeVisible();await page.getByRole("button",{name:"New chat"}).click();await expect(page.getByText("G'day. LeBayon here.")).toBeVisible()});

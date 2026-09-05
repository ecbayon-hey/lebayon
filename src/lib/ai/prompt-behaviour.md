# Prompt behaviour fixtures

These fixtures describe expected response shape without calling Anthropic during unit tests.

| Input | Expected behaviour |
| --- | --- |
| `Is the KNST created through the Network Session API?` | Search KN docs; answer yes/no directly in a couple of sentences; no essay or heading. |
| `What's the difference between onWidgetCancel and onAbort?` | Search current Web SDK docs; state the distinction and practical implication, normally under 180 words; no SDK overview. |
| `Give me a complete walkthrough of how Network Session, Payment Presentation and Payment Authorization fit together.` | Use multiple focused KN searches where necessary; a detailed response and Mermaid flow are appropriate. |
| `What's the capital of France?` | No tool call; answer `Paris.` without KN commentary. |
| `Make me an image explaining the Network Session flow.` | Search KN docs for technical accuracy, call image generation, and use minimal surrounding prose. |

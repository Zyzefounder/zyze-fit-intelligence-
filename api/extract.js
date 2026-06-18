export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === "OPTIONS") return res.status(200).end();
  
  const { transcript, system } = req.body;
  
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": "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",
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system,
      messages: [{ role: "user", content: transcript }]
    })
  });
  
  const data = await response.json();
  res.status(200).json(data);
}

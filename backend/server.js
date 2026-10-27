require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") || "*" }));
app.use(express.json({ limit: "5mb" }));

app.get("/api/health", (req, res) => res.json({ ok: true, service: "hubmind-backend" }));

app.use("/api/llm-nodes", require("./routes/llmNodes"));
app.use("/api/hubs", require("./routes/hubs"));
app.use("/api/super-hubs", require("./routes/superHubs"));
app.use("/api/interfaces", require("./routes/interfaces"));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`hubmind-backend listening on :${PORT}`));

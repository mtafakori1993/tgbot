const express = require("express");
const path = require("path");
const multer = require("multer");
const FormData = require("form-data");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

const BALE_TOKEN = process.env.BALE_TOKEN;

if (!BALE_TOKEN) {
  console.error("❌ BALE_TOKEN is not set");
  console.error("Run:");
  console.error('export BALE_TOKEN="YOUR_TOKEN"');
  process.exit(1);
}

const BALE_API = `https://tapi.bale.ai/bot${BALE_TOKEN}`;

const uploadDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, {
    recursive: true
  });
}

const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 50 * 1024 * 1024
  }
});

app.use(express.json());

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);


// ═══════════════════════════════════════
// Helper
// ═══════════════════════════════════════

async function baleRequest(
  method,
  body = null
) {
  const options = {
    method
  };

  if (body) {
    options.headers = {
      "Content-Type": "application/json"
    };

    options.body = JSON.stringify(body);
  }

  const response = await fetch(
    `${BALE_API}/${method}`,
    options
  );

  const text = await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    data = {
      ok: false,
      error: text
    };
  }

  return data;
}


// ═══════════════════════════════════════
// GET ME
// ═══════════════════════════════════════

app.get(
  "/api/getMe",
  async (req, res) => {

    try {

      const data =
        await baleRequest("getMe");

      res.json(data);

    } catch (error) {

      console.error(error);

      res.status(500).json({
        ok: false,
        error: error.message
      });

    }

  }
);


// ═══════════════════════════════════════
// GET UPDATES
// ═══════════════════════════════════════

app.get(
  "/api/getUpdates",
  async (req, res) => {

    try {

      const url =
        new URL(
          `${BALE_API}/getUpdates`
        );

      if (req.query.offset) {
        url.searchParams.set(
          "offset",
          req.query.offset
        );
      }

      const response =
        await fetch(url);

      const text =
        await response.text();

      let data;

      try {
        data = JSON.parse(text);
      } catch {
        data = {
          ok: false,
          error: text
        };
      }

      res.json(data);

    } catch (error) {

      console.error(error);

      res.status(500).json({
        ok: false,
        error: error.message
      });

    }

  }
);


// ═══════════════════════════════════════
// SEND MESSAGE
// ═══════════════════════════════════════

app.post(
  "/api/sendMessage",
  async (req, res) => {

    try {

      const {
        chat_id,
        text,
        reply_to_message_id
      } = req.body;

      if (!chat_id) {
        return res.status(400).json({
          ok: false,
          error: "chat_id is required"
        });
      }

      if (!text) {
        return res.status(400).json({
          ok: false,
          error: "text is required"
        });
      }

      const body = {
        chat_id,
        text
      };

      if (reply_to_message_id) {
        body.reply_to_message_id =
          Number(reply_to_message_id);
      }

      const data =
        await baleRequest(
          "sendMessage",
          body
        );

      res.json(data);

    } catch (error) {

      console.error(error);

      res.status(500).json({
        ok: false,
        error: error.message
      });

    }

  }
);


// ═══════════════════════════════════════
// SEND DOCUMENT
// ═══════════════════════════════════════

app.post(
  "/api/sendDocument",
  upload.single("document"),
  async (req, res) => {

    if (!req.file) {
      return res.status(400).json({
        ok: false,
        error: "No file uploaded"
      });
    }

    try {

      if (!req.body.chat_id) {
        return res.status(400).json({
          ok: false,
          error: "chat_id is required"
        });
      }

      const form =
        new FormData();

      form.append(
        "chat_id",
        req.body.chat_id
      );

      form.append(
        "document",
        fs.createReadStream(
          req.file.path
        ),
        {
          filename:
            req.file.originalname,

          contentType:
            req.file.mimetype ||
            "application/octet-stream"
        }
      );

      if (req.body.caption) {
        form.append(
          "caption",
          req.body.caption
        );
      }

      if (
        req.body.reply_to_message_id
      ) {
        form.append(
          "reply_to_message_id",
          req.body.reply_to_message_id
        );
      }

      const response =
        await fetch(
          `${BALE_API}/sendDocument`,
          {
            method: "POST",
            headers: form.getHeaders(),
            body: form
          }
        );

      const text =
        await response.text();

      let data;

      try {
        data = JSON.parse(text);
      } catch {
        data = {
          ok: false,
          error: text
        };
      }

      res.json(data);

    } catch (error) {

      console.error(
        "sendDocument:",
        error
      );

      res.status(500).json({
        ok: false,
        error: error.message
      });

    } finally {

      fs.unlink(
        req.file.path,
        () => {}
      );

    }

  }
);


// ═══════════════════════════════════════
// SEND AUDIO
// MP3 / M4A
// ═══════════════════════════════════════

app.post(
  "/api/sendAudio",
  upload.single("audio"),
  async (req, res) => {

    if (!req.file) {
      return res.status(400).json({
        ok: false,
        error: "No audio file uploaded"
      });
    }

    try {

      if (!req.body.chat_id) {
        return res.status(400).json({
          ok: false,
          error: "chat_id is required"
        });
      }

      const filename =
        req.file.originalname;

      const ext =
        path
          .extname(filename)
          .toLowerCase();

      if (
        ext !== ".mp3" &&
        ext !== ".m4a"
      ) {

        return res.status(400).json({
          ok: false,
          error:
            "Bale sendAudio accepts only MP3 or M4A"
        });

      }

      const form =
        new FormData();

      form.append(
        "chat_id",
        req.body.chat_id
      );

      form.append(
        "audio",
        fs.createReadStream(
          req.file.path
        ),
        {
          filename,

          contentType:
            req.file.mimetype ||
            (
              ext === ".mp3"
                ? "audio/mpeg"
                : "audio/mp4"
            )
        }
      );

      if (req.body.caption) {
        form.append(
          "caption",
          req.body.caption
        );
      }

      if (
        req.body.reply_to_message_id
      ) {
        form.append(
          "reply_to_message_id",
          req.body.reply_to_message_id
        );
      }

      const response =
        await fetch(
          `${BALE_API}/sendAudio`,
          {
            method: "POST",

            headers:
              form.getHeaders(),

            body: form
          }
        );

      const text =
        await response.text();

      let data;

      try {
        data = JSON.parse(text);
      } catch {
        data = {
          ok: false,
          error: text
        };
      }

      res.json(data);

    } catch (error) {

      console.error(
        "sendAudio:",
        error
      );

      res.status(500).json({
        ok: false,
        error: error.message
      });

    } finally {

      fs.unlink(
        req.file.path,
        () => {}
      );

    }

  }
);


// ═══════════════════════════════════════
// HEALTH
// ═══════════════════════════════════════

app.get(
  "/api/health",
  (req, res) => {

    res.json({
      ok: true,
      service: "bale-test-proxy"
    });

  }
);


// ═══════════════════════════════════════
// START
// ═══════════════════════════════════════

app.listen(
  PORT,
  () => {

    console.log("");
    console.log(
      "🚀 Bale Test Proxy"
    );
    console.log("");
    console.log(
      `🌐 http://localhost:${PORT}`
    );
    console.log("");
    console.log(
      "Bale API:",
      BALE_API.replace(
        BALE_TOKEN,
        "***"
      )
    );
    console.log("");

  }
);
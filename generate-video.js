export default async function handler(req, res) {
  const { prompt, userKey, imageConfig } = req.body;
  // Ưu tiên lấy Key khách nhập, nếu không có thì lấy Key hệ thống trên Vercel
  const finalApiKey = userKey || process.env.SYSTEM_GEMINI_API_KEY;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/veo-3:generateVideo?key=${finalApiKey}`, {
      method: 'POST',
      body: JSON.stringify({ prompt, ...imageConfig })
    });
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: "Lỗi tạo video" });
  }
}
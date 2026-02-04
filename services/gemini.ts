
import { GoogleGenAI, VideoGenerationReferenceType } from "@google/genai";
import { Resolution, AspectRatio, VideoMode } from "../types";

export interface VeoRequest {
  mode: VideoMode;
  prompt: string;
  resolution: Resolution;
  aspectRatio: AspectRatio;
  images?: string[]; // base64 strings
  previousVideo?: any; // Dùng cho tính năng nối mạch Cinema Flow
  negativePrompt?: string;
  onProgress?: (msg: string) => void;
  customApiKey?: string;
}

/**
 * Hàm fetch video thô và tạo Blob URL để bypass các lỗi sandbox/CDN
 */
const fetchVideoAsBlobUrl = async (uri: string, apiKey: string): Promise<string> => {
  try {
    const response = await fetch(`${uri}&key=${apiKey}`);
    if (!response.ok) throw new Error("Không thể tải video từ CDN.");
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (err) {
    console.error("Lỗi fetch blob:", err);
    return `${uri}&key=${apiKey}`; // Trả về link gốc nếu fetch blob lỗi
  }
};

export const generateVeoVideo = async ({
  mode,
  prompt,
  resolution,
  aspectRatio,
  images = [],
  previousVideo,
  negativePrompt,
  onProgress,
  customApiKey
}: VeoRequest): Promise<any> => {
  // Lấy API Key từ customApiKey (Chế độ A - sessionStorage) hoặc môi trường (Chế độ B)
  const apiKey = customApiKey || process.env.API_KEY;
  if (!apiKey) throw new Error("API Key không tồn tại.");
  
  const ai = new GoogleGenAI({ apiKey });
  
  const model = mode === VideoMode.CONSISTENCY || previousVideo 
    ? 'veo-3.1-generate-preview' 
    : 'veo-3.1-fast-generate-preview';
  
  onProgress?.("Đang chuẩn bị kịch bản...");

  let apiAspectRatio: "16:9" | "9:16" = "16:9";
  if (aspectRatio === AspectRatio.PORTRAIT || aspectRatio === AspectRatio.SUPER_TALL) {
    apiAspectRatio = "9:16";
  }

  try {
    let operation;

    if (previousVideo) {
      operation = await ai.models.generateVideos({
        model: 'veo-3.1-generate-preview',
        prompt: prompt,
        video: previousVideo,
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: apiAspectRatio
        }
      });
    } else if (mode === VideoMode.TEXT_TO_VIDEO) {
      operation = await ai.models.generateVideos({
        model,
        prompt: prompt + (negativePrompt ? ` [Negative: ${negativePrompt}]` : ''),
        config: {
          numberOfVideos: 1,
          resolution,
          aspectRatio: apiAspectRatio
        }
      });
    } else if (mode === VideoMode.IMAGE_TO_VIDEO) {
      operation = await ai.models.generateVideos({
        model,
        prompt,
        image: {
          imageBytes: images[0].split(',')[1],
          mimeType: 'image/png'
        },
        config: {
          numberOfVideos: 1,
          resolution,
          aspectRatio: apiAspectRatio
        }
      });
    } else if (mode === VideoMode.INTERPOLATION) {
      operation = await ai.models.generateVideos({
        model,
        prompt,
        image: {
          imageBytes: images[0].split(',')[1],
          mimeType: 'image/png'
        },
        config: {
          numberOfVideos: 1,
          resolution,
          aspectRatio: apiAspectRatio,
          lastFrame: {
            imageBytes: images[1].split(',')[1],
            mimeType: 'image/png'
          }
        }
      });
    } else if (mode === VideoMode.CONSISTENCY) {
      const referenceImages = images.map(img => ({
        image: {
          imageBytes: img.split(',')[1],
          mimeType: 'image/png'
        },
        referenceType: VideoGenerationReferenceType.ASSET
      }));

      operation = await ai.models.generateVideos({
        model,
        prompt,
        config: {
          numberOfVideos: 1,
          referenceImages,
          resolution,
          aspectRatio: apiAspectRatio
        }
      });
    }

    if (!operation) throw new Error("Không thể khởi tạo tiến trình.");

    onProgress?.("Đang xử lý mạch phim (Veo 3.1 Pro)...");

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 8000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
      onProgress?.("Đang tạo nên kiệt tác điện ảnh...");
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) throw new Error("Không tìm thấy link video.");

    onProgress?.("Đang nén và đồng bộ tệp...");
    const blobUrl = await fetchVideoAsBlobUrl(downloadLink, apiKey);
    
    return { ...operation, finalUrl: blobUrl };

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    if (error.message?.includes("Requested entity was not found") || error.message?.includes("API key not valid")) {
      throw new Error("Lỗi xác thực API Key. Vui lòng kiểm tra lại Key hoặc Project ID.");
    }
    throw error;
  }
};

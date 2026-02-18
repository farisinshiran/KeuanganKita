// Vision API Integration

import { parseReceiptText } from './receiptParser';

/**
 * Analyze a receipt image using Google Vision API
 * @param {File} imageFile - The image file to analyze
 * @param {string} apiKey - Google Vision API key
 * @returns {Array} Parsed transactions from the receipt
 */
export const analyzeReceiptWithVision = async (imageFile, apiKey) => {
  try {
    const base64Image = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(imageFile);
    });

    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { content: base64Image },
            features: [
              { type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 },
              { type: 'TEXT_DETECTION' } // Additional text detection for better accuracy
            ],
            imageContext: {
              languageHints: ['id', 'en'],
              textDetectionParams: {
                enableTextDetectionConfidenceScore: true
              }
            }
          }]
        })
      }
    );

    const data = await response.json();
    if (data.error) throw new Error(data.error.message || 'Vision API error');
    if (!data.responses?.[0]) throw new Error('No response from Vision API');

    const fullTextAnnotation = data.responses[0].fullTextAnnotation;
    const textAnnotations = data.responses[0].textAnnotations;
    if (!textAnnotations?.length && !fullTextAnnotation) {
      throw new Error('No text detected in image');
    }

    const fullText = fullTextAnnotation?.text || textAnnotations[0].description;
    console.log('📝 OCR Raw Text:\n', fullText);
    return parseReceiptText(fullText);
  } catch (error) {
    console.error('Vision API Error:', error);
    throw error;
  }
};

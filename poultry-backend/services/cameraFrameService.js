const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { analyzeChickenImage, formatFullDescription } = require('./aiService');

function createCameraFrameService({ supabase, uploadDir, deleteAfterProcessing = false }) {
  const pendingFrames = [];
  let processing = false;

  async function updateFrame(frameId, values) {
    const { error } = await supabase
      .from('camera_frames')
      .update(values)
      .eq('frame_id', frameId);

    if (error) throw error;
  }

  async function processNextFrame() {
    if (processing || pendingFrames.length === 0) return;

    processing = true;
    const frame = pendingFrames.shift();

    try {
      await updateFrame(frame.frameId, {
        status: 'processing',
        processing_started_at: new Date().toISOString()
      });

      const aiResult = await analyzeChickenImage(frame.filePath, frame.mimeType);
      const fullDescription = formatFullDescription(aiResult.description, aiResult.suggestions);

      await updateFrame(frame.frameId, {
        status: 'completed',
        ai_stress_risk: aiResult.stress_risk,
        ai_confidence: aiResult.confidence,
        ai_indicators: aiResult.indicators,
        ai_description: fullDescription,
        processed_at: new Date().toISOString(),
        processing_error: null
      });
    } catch (error) {
      try {
        await updateFrame(frame.frameId, {
          status: 'failed',
          processing_error: error.message,
          processed_at: new Date().toISOString()
        });
      } catch (updateError) {
        console.error(`[CAMERA] Could not record failed frame ${frame.frameId}: ${updateError.message}`);
      }
    } finally {
      if (deleteAfterProcessing) {
        await fs.unlink(frame.filePath).catch(() => undefined);
      }
      processing = false;
      setImmediate(processNextFrame);
    }
  }

  function enqueue(frame) {
    pendingFrames.push(frame);
    setImmediate(processNextFrame);
  }

  async function createAndQueueFrame({ deviceId, capturedAt, sequenceId, firmwareVersion, file }) {
    if (!supabase) {
      throw new Error('Supabase is required for camera frame persistence.');
    }

    const frameId = crypto.randomUUID();
    const frameRecord = {
      frame_id: frameId,
      device_id: deviceId,
      captured_at: capturedAt || null,
      sequence_id: sequenceId || null,
      firmware_version: firmwareVersion || null,
      storage_name: path.basename(file.path),
      mime_type: file.mimetype,
      size_in_bytes: file.size,
      status: 'pending'
    };

    const { error } = await supabase.from('camera_frames').insert([frameRecord]);
    if (error) throw error;

    enqueue({
      frameId,
      filePath: file.path,
      mimeType: file.mimetype
    });

    return frameRecord;
  }

  return { createAndQueueFrame };
}

module.exports = { createCameraFrameService };

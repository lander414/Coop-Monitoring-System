const express = require('express');
const router = express.Router();

// Route: POST /api/images
// COOP-14: Standalone Image Upload & Storage Endpoint
module.exports = (upload) => {
  router.post('/', upload.single('image'), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ 
          success: false, 
          error: 'No file provided or invalid file type. Only JPEG and PNG are allowed.' 
        });
      }

      return res.status(201).json({
        success: true,
        message: 'Image uploaded and stored successfully.',
        data: {
          imageId: req.file.filename,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          sizeInBytes: req.file.size,
          path: req.file.path,
          uploadedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
};
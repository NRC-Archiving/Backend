const express = require('express');
const router = express.Router();
const passport = require('passport');
const multer = require('multer');
const File = require('../model/File');
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
      cb(null, file.fieldname + '-' + uniqueSuffix)
    }
});
const fileFilter = (req, file, cb) => {
    if (file.mimetype == 'application/pdf') {
        cb(null, true);
    } else {
        cb(new Error('WrongFileType'), false);
    }
}
const upload = multer({ storage: storage, fileFilter: fileFilter });

const checkUserRole = require('../validation/credential');

router.post('/document', passport.authenticate('jwt', { session: false }), checkUserRole(['admin','superadmin']), (req,res) => {
    upload.single('document')(req, res, async (err) => {
        if (err) {
            if (err.message == 'WrongFileType') {
                return res.status(400).json({ message:'File type not accepted. Only PDF accepted' });
            }
            return res.status(500).json({ message:'File upload failed', error: err.message });
        }

        if (!req.file) {
            return res.status(400).json({ message:'No file uploaded' });
        }

        const fileData = new File({
            filename: req.file.filename,
            path: req.file.path
        });
        const savedFile = await fileData.save();

        return res.json({
            message:'File uploaded succesfully',
            file: savedFile
        });
    });
});

router.get('/document/:filename', passport.authenticate('jwt', { session: false }), checkUserRole(['admin','superadmin']), (req,res) => {
    File.findOne({ filename: req.params.filename })
    .then((file) => {
        if (!file) {
            return res.status(404).json({ message:'File not found' });
        } else {
            res.download(file.path, req.params.filename+".pdf", (err) => {
                if (err) {
                    return res.status(500).json({
                        error: err,
                        message: err.message
                    });
                }
            });
        }
    })
    .catch(() => {
        return res.status(404).json({ message:'File cannot be retrieved' });
    });
});


router.get('/list-document', passport.authenticate('jwt', { session: false }), checkUserRole(['admin','superadmin']), async (req,res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const startIndex = (page - 1) * limit;
    const total = await File.countDocuments();
    const files = await File.find().skip(startIndex).limit(limit);

    return res.json({
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        data: files
    });
});

module.exports = router;
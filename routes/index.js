'use strict';

const express = require('express');

const router = express.Router();

/* GET home page. */
router.get('/', function (req, res) {
    res.render('index', { title: 'i18n' });
});

module.exports = router;
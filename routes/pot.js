"use strict";

const express = require("express");
const gulp = require("gulp");
const gettext = require("gulp-angular-gettext");
const path = require("path");
const fs = require("fs");
const del = require("del");
const Busboy = require("busboy");

const router = express.Router();

const uploadFolderBase = "./temp";
const outputFilename = "renderer.pot";

var uploadFolder;

/* POST for POT generation. */
router.post("/", function (req, res) {
    console.log(new Date().toString());

    // a random GUID named folder within the base folder
    uploadFolder = path.join(uploadFolderBase, guid());

    // setup busboy
    const busboy = new Busboy({ headers: req.headers });

    // busboy's file event
    busboy.on("file", function (fieldname, file, filename, encoding, mimetype) {
        console.log("Receiving filename: " + filename + ", mimetype: " + mimetype);

        const saveAs = path.join(uploadFolder, path.basename(filename));
        console.log("Saving " + filename + " to: " + saveAs);

        // create the folder 
        ensureDirectoryExistence(saveAs);

        // save the file
        file.pipe(fs.createWriteStream(saveAs));

        file.on("end", function () {
            console.log("Finished uploading " + filename);
        });
    });

    // busboy's finish event
    busboy.on("finish", function () {
        console.log("\nSource files uploaded - Starting processing...");

        // execute the 'pot' task
        gulp.start("pot", function () {
            console.log("Done generating POT file - Sending client response...");

            // send the file
            const stream = fs.createReadStream(path.join(uploadFolder, outputFilename));
            stream.pipe(res);

            var error;
            stream.on("error", function (err) {
                console.log("Error sending client response");
                error = true;
            });

            stream.on("close", function () {
                if (!error) {
                    console.log("Client response sent");

                    // execute the 'cleanPot' task
                    gulp.start("cleanPot", function () {
                        console.log("Done removing: " + uploadFolder + "\n");
                    });
                }
            });
        });
    });

    // pipe request stream to busboy
    req.pipe(busboy);
});

/* extract and generate POT file */
gulp.task("pot", function () {
    const htmlFiles = path.join(uploadFolder, "*.html");
    const jsFiles = path.join(uploadFolder, "*.js");

    const scan = [htmlFiles, jsFiles];

    console.log("Generating POT file...");

    return gulp.src(scan)
        .pipe(gettext.extract(outputFilename, {
            // options to pass to angular-gettext-tools...

        }))
        .pipe(gulp.dest(uploadFolder));
});

// Remove the folder and the files in it
gulp.task("cleanPot", function () {
    console.log("Deleting files and folder: " + uploadFolder);

    return del([path.join(uploadFolder, "**")]);    // no dot between asterisks so folder is removed as well 
});

// random GUID
function guid() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }
    return s4() + s4() + "-" + s4() + "-" + s4() + "-" + s4() + "-" + s4() + s4() + s4();
}

// creates the directory if it does not exist
function ensureDirectoryExistence(filePath) {
    const dirname = path.dirname(filePath);
    if (fs.existsSync(dirname)) {
        return true;
    }

    ensureDirectoryExistence(dirname);
    fs.mkdirSync(dirname);

    return true;
}

module.exports = router;
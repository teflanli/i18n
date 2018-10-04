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

var compileUploadFolder;
var compileOutputFilename;

/* POST for JSON generation. */
router.post("/", function (req, res) {
    console.log(new Date().toString());

    // a random GUID named folder within the base folder
    compileUploadFolder = path.join(uploadFolderBase, guid());

    // setup busboy
    const busboy = new Busboy({ headers: req.headers });

    // busboy's file event
    busboy.on("file", function (fieldname, file, filename, encoding, mimetype) {
        console.log("Receiving filename: " + filename + ", mimetype: " + mimetype);

        compileOutputFilename = path.parse(filename).name + ".json";

        const saveAs = path.join(compileUploadFolder, path.basename(filename));
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
        console.log("\nSource file uploaded - Starting processing...");

        // execute the 'compile' task
        gulp.start("compile", function () {
            console.log("Done generating JSON file - Sending client response...");

            // send the file
            const stream = fs.createReadStream(path.join(compileUploadFolder, compileOutputFilename));
            stream.pipe(res);

            var error;
            stream.on("error", function (err) {
                console.log("Error sending client response");
                error = true;
            });

            stream.on("close", function () {
                if (!error) {
                    console.log("Client response sent");

                    // execute the 'cleanCompile' task
                    gulp.start("cleanCompile", function () {
                        console.log("Done removing: " + compileUploadFolder + "\n");
                    }); 
                }
            });
        });
    });

    // pipe request stream to busboy
    req.pipe(busboy);
});

/* compile and generate json file */
gulp.task('compile', function () {
    const poFiles = path.join(compileUploadFolder, "*.po");

    console.log("Compiling PO file(s)...");

    return gulp.src(poFiles)
        .pipe(gettext.compile({
            // options to pass to angular-gettext-tools...
            format: 'json'
        }))
        .pipe(gulp.dest(compileUploadFolder));
});

// Remove the folder and the files in it
gulp.task("cleanCompile", function () {
    console.log("Deleting files and folder: " + compileUploadFolder);

    return del([path.join(compileUploadFolder, "**")]);    // no dot between asterisks so folder is removed as well 
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
require("dotenv").config({ path: "./.env.local" });

const { google } = require("googleapis");
const path = require("path");
const fs = require("fs");

const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);

oauth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });

const Drive = google.drive({
  version: "v3",
  auth: oauth2Client,
});

async function uploadFile(filePath, fileName) {
  try {
    //handle different type of file
    const fileExtension = fileName.split(".").pop().toLowerCase();
    const mimeTypes = {
      //image file
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      //audio file
      mp3: "audio/mpeg",
      wav: "audio/wav",
    };
    if (mimeTypes[fileExtension] === undefined) {
      throw new Error("Invalid file type");
    }
    const response = await Drive.files.create({
      requestBody: {
        name: fileName,
        mimeType: mimeTypes[fileExtension],
      },
      media: {
        mimeType: mimeTypes[fileExtension],
        body: fs.createReadStream(filePath),
      },
    });
    return response.data;
  } catch (error) {
    // console.error(error.message);
    throw error;
  }
}

async function deleteFile(fileId) {
  try {
    const response = await Drive.files.delete({
      fileId: fileId,
    });
    console.log(response.data, response.status);
  } catch (error) {
    console.error(error.message);
  }
}

async function generatePublicUrl(fileId) {
  try {
    await Drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    });
    const result = await Drive.files.get({
      fileId: fileId,
      fields: "webViewLink, webContentLink",
    });
    return result.data;
  } catch (error) {
    console.error(error.message);
    throw error;
  }
}

module.exports = {
  uploadFile,
  deleteFile,
  generatePublicUrl,
};

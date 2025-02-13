const express = require("express");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const bcrypt = require("bcrypt");
const cors = require("cors");
const path = require("path");
const knex = require("./knex");
const multer = require("multer");
const { uploadFile, generatePublicUrl } = require("./driveApiHandler");

const app = express();
const upload = multer({ dest: "uploads/" });

// ---------- Middleware (START) ----------
if (!process.env.NODE_ENV) {
  app.use(
    cors({
      origin: "http://localhost:5173",
      credentials: true,
    })
  );
} else {
  app.use("/", express.static(path.join(__dirname, "../../client/dist")));
}

app.use(express.json());

app.use(
  session({
    store: new pgSession({
      conString:
        process.env.DATABASE_URL ||
        `postgres://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false },
  })
);
// ----------- Middleware (END) -----------

// ----------- User Endpoints ------------
// "get" endpoint (get all users)
app.get("/api/user", async (req, res) => {
  try {
    const users = await knex
      .select("id", "username", "city", "country")
      .from("users")
      .limit(100);

    res.json({ users });
  } catch (error) {
    console.error("Database connection error:", error);
    res.status(500).json({ error: error.message });
  }
});

// "get" endpoint (get user by id)
app.get("/api/user/:id", async (req, res) => {
  //use that imgUrl to convert url into img, send base64
  try {
    const id = req.params.id;
    const user = await knex
      .select("id", "username", "city", "country", "profile_img_url")
      .from("users")
      .where("id", id)
      .first();

    if (user.profile_img_url !== null) {
      const downloadImgResponse = await fetch(user.profile_img_url, {
        method: "GET",
      });
      const imgArrayBuffer = await downloadImgResponse.arrayBuffer();
      const imgBase64 = Buffer.from(imgArrayBuffer).toString("base64");
      user.profileImgBase64 = `data:image/*;base64,${imgBase64}`;
    }
    res.json(user);
  } catch (error) {
    console.error("Database connection error:", error);
    res.status(500).json({ error: error.message });
  }
});

// "delete" endpoint (delete user by id)
app.delete("/api/user/:id", async (req, res) => {
  try {
    const id = req.params.id;
    await knex("users").where("id", id).del();

    res.status(204);
    res.json({ message: "Delete route is working correctly." });
  } catch (error) {
    console.error("Database connection error.", error);
    res.status(500).json({ error: error.message });
  }
});

// ----------- Project Endpoints ------------
// "get" endpoint (get all project information)
app.get("/api/project", async (req, res) => {
  try {
    const projects = await knex.select("*").from("projects").limit(100);

    res.json(projects);
  } catch (error) {
    console.error("Database connection error:", error);
    res.status(500).json({ error: error.message });
  }
});

// "get" endpoint (get project by id)
app.get("/api/project/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const project = await knex
      .select("*")
      .from("projects")
      .where("id", id)
      .first();

    res.json(project);
  } catch (error) {
    console.error("Database connection error:", error);
    res.status(500).json({ error: error.message });
  }
});

// "post" endpoint (post new project and link to creating user)
app.post("/api/project/create/:id", async (req, res) => {
  try {
    const userId = Number(req.params.id); // capture user id (the user creating the project)
    const projectId = await knex("projects").returning("id").insert({
      project_name: req.body.project_name,
      leader_id: userId,
      description: req.body.description,
    }); // insert new project into table and return new project id
    const projectAndUserIds = await knex("user_projects").insert({
      user_id: userId,
      project_id: projectId[0].id,
    });

    res.json({ userId: userId, projectId: projectId[0].id });
  } catch (error) {
    console.error("Database connection error:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST add current user to project
app.post("/api/project/:userId/:projectId", async (req, res) => {
  try {
    const userId = Number(req.params.userId); // capture the user id from URL params
    const projectId = Number(req.params.projectId); // capture the project id from the URL params

    if (!userId || !projectId) {
      return res
        .status(400)
        .json({ message: "User ID and Project ID are required" });
    }

    // insert the user + project into the user_projects table
    const [newUserProject] = await knex("user_projects")
      .insert({ user_id: userId, project_id: projectId })
      .returning("*"); // returns the newly inserted row

    // check if the insertion was successful
    if (newUserProject) {
      return res.status(201).json({
        message: "User successfully added to the project",
        data: newUserProject,
      });
    } else {
      return res.status(500).json({ message: "Failed to add user to project" });
    }
  } catch (error) {
    console.error("Error adding user to project:", error);
    return res.status(500).json({
      message: "An error occurred while adding the user to the project",
    });
  }
});

// GET /api/project/:projectId/members (get all members of given project)
app.get("/api/project/:projectId/member", async (req, res) => {
  try {
    const projectId = req.params.projectId;
    let members = await knex("user_projects")
      .join("users", "user_id", "users.id")
      .select("users.id", "users.username")
      .where("project_id", projectId);

    // ensures leader is the first member
    const project = await knex
      .select("*")
      .from("projects")
      .where("id", projectId)
      .first();

    let leader = members.filter((member) => member.id === project.leader_id)[0];

    const leaderIndex = members.indexOf(leader);

    members.splice(leaderIndex, 1);
    members.unshift(leader);

    res.json(members);
  } catch (error) {
    console.error("Error fetching members:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/project/:userId (get all projects from a user) by Garett
app.get("/api/project/:userId/projects", async (req, res) => {
  try {
    const userId = req.params.userId;
    let contributedProjects = await knex("projects")
      .select("projects.*") // get all colums in the project table
      .join("user_projects", "projects.id", "user_projects.project_id")
      .where("user_projects.user_id", userId);

    // response with an array of all contributed projects of a user
    res.status(200).json(contributedProjects);
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/project/:projectId/stems (get all stems of given project)
app.get("/api/project/:projectId/stem", async (req, res) => {
  const { projectId } = req.params;
  try {
    const stems = await knex("stems")
      .where({ project_id: projectId })
      .select("*");

    res.json(stems);
  } catch (error) {
    console.error("Error fetching stems:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/stem/:id
app.delete("/api/stem/:id", async (req, res) => {
  try {
    const id = req.params.id;
    await knex("stems").where("id", id).del();

    res.status(204);
    res.json({ message: "Stem successfully deleted." });
  } catch (error) {
    console.error("Database connection error.", error);
    res.status(500).json({ error: error.message });
  }
});

// ---------- Authentication (START) ----------
// POST /api/auth/register
// it (should allow a new user to register)
app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, password, city, country } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const [newUser] = await knex("users")
      .insert({
        username,
        password: hashedPassword,
        city,
        country,
      })
      .returning(["id", "username", "city", "country"]);

    res
      .status(201)
      .json({ message: "User registered successfully", user: newUser });
  } catch (error) {
    console.error("Database connection error.", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/login
// it (should allow an existing user to login)
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await knex("users").where({ username }).first();

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    req.session.userId = user.id;
    req.session.username = user.username;

    res.json({ message: "Login succesful" });
  } catch (error) {
    console.error("Database connection error.", error);
    res.status(500).json({ error: error.message });
  }
});

// Checks if a user is logged in
// it (should fetch logged in users profile from database using the userId stored in the session)
app.get("/api/auth/user", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  try {
    const user = await knex("users")
      .select("id", "username", "city", "country", "profile_img_url")
      .where({ id: req.session.userId })
      .first();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (user.profile_img_url !== null) {
      const downloadImgResponse = await fetch(user.profile_img_url, {
        method: "GET",
      });
      const imgArrayBuffer = await downloadImgResponse.arrayBuffer();
      const imgBase64 = Buffer.from(imgArrayBuffer).toString("base64");
      user.profileImgBase64 = `data:image/*;base64,${imgBase64}`;
    }
    return res.json({ message: "Authorized", user: user });
  } catch (error) {
    console.error("Database connection error.", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/auth/logout
// it (should log the user out)
app.get("/api/auth/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Failed to logout" });
    }

    res.json({ message: "Logout  successful" });
  });
});
// ----------- Authentication (END) -----------

// ---------Upload file to google drive---------
// POST /api/user/upload
app.post("/api/user/upload", upload.single("file"), async (req, res) => {
  try {
    const { file } = req;
    const { project_id } = req.body;
    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Upload the file to Google Drive
    const uploadedFile = await uploadFile(file.path, file.originalname);
    // Generate a public URL for the uploaded file
    const publicUrl = await generatePublicUrl(uploadedFile.id);
    // Store the file ID and URL in the stems table
    const [newStem] = await knex("stems")
      .insert({
        stem_name: file.originalname,
        url: publicUrl.webContentLink,
        project_id: parseInt(project_id, 10),
        api_id: uploadedFile.id,
      })
      .returning(["id", "stem_name", "url", "project_id", "api_id"]);

    res
      .status(201)
      .json({ message: "File uploaded successfully", stem: newStem });
  } catch (error) {
    console.error("File upload error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/user/profile/image", upload.single("file"), async (req, res) => {
  try {
    //destructure req.file and req.body
    const { file } = req;
    const { user_id } = req.body;
    if (!file) {
      return res.status(400).json({ message: "No image uploaded" });
    }
    // Upload image to Google Drive
    const uploadedImg = await uploadFile(file.path, file.originalname);
    //use id get url to display in frontend
    const publicUrl = await generatePublicUrl(uploadedImg.id);
    //update profile img url in users table
    const [newProfileImgUrl] = await knex("users")
      .where("id", user_id)
      .update({
        profile_img_url: publicUrl.webContentLink,
      })
      .returning(["id", "profile_img_url"]);
    //send response
    if (newProfileImgUrl) {
      const downloadImgResponse = await fetch(
        newProfileImgUrl.profile_img_url,
        {
          method: "GET",
        }
      );
      const imgArrayBuffer = await downloadImgResponse.arrayBuffer();
      const imgBase64 = Buffer.from(imgArrayBuffer).toString("base64");
      res.status(201).json({
        message: "Profile image uploaded successfully",
        image: `data:image/*;base64,${imgBase64}`,
      });
    }
  } catch (error) {
    console.error("Profile image upload error:", error);
    res.status(500).json({ error: error.message });
  }
});

const port = process.env.PORT || 8080;

app.listen(port, () => {
  console.log(`We can hear you over on port ${port} 👂`);
});

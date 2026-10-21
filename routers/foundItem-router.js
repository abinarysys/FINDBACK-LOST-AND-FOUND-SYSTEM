// Routes for creating and browsing found-item reports.

// Set up the router and database connection.
const router = require("express").Router();
const db = require("../config/db.js");

// Reuse authentication and upload checks on the report routes.
const upload = require("../middleware/upload-middleware.js");
const authMiddleware = require("../middleware/auth-middleware.js");

// Show the form where a signed-in user can report a found item.
router.get("/", authMiddleware, (req, res) => {
  res.render("submitFoundItem");
});

// Save the submitted report after validating its required fields.
router.post(
  "/submit",
  authMiddleware,
  upload.single("foundPhoto"),
  (req, res) => {
    console.log(req.body);
    const { name, category_id, description, locFound, dateFound } = req.body;

    // Confirm a signed-in user is available before saving their report.
    if (!req.session.user) {
      req.flash("error", "Please log in to submit feedback.");
      return res.redirect("/auth/login");
    }

    // Tie the new report to the account stored in the session.
    const userId = req.session.user.user_id;

    // A report needs a name, category, photo, location, and date.
    if (!name || !category_id || !req.file || !locFound || !dateFound) {
      req.flash("error", "Please complete all required fields.");
      return res.redirect("/found");
    }

    // Store a web path to the uploaded photo in the database.
    const foundItemPic = req.file ? "/uploads/" + req.file.filename : null;
    console.log("FORM DATA:", req.body);
    console.log("UPLOADED FILE:", req.file);
    const submitFoundItem = `INSERT INTO found_items (user_id, category_id, 
    item_name, description, location, date_found, photo_path) VALUES (?,?,?,?,?,?,?)`;
    db.query(
      submitFoundItem,
      [
        userId,
        category_id,
        name,
        description,
        locFound,
        dateFound,
        foundItemPic,
      ],
      (err) => {
        if (err) {
          req.flash("error", "Unable to submit");
          return res.status(500).send("Error: " + err.message);
        }
        req.flash("success", "Submitted Successfully");
        return res.redirect("/found");
      },
    );
  },
);

module.exports = router;

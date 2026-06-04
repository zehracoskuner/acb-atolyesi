// readingListsController.js
const ReadingList = require("../models/ReadingList");  // import → require

exports.getReadingLists = async (req, res) => {        // export → exports.
  try {
    const lists = await ReadingList.find({ owner: req.user.id })
      .populate("works", "title coverImage chapterCount")
      .lean();
    res.json({ items: lists });
  } catch (err) {
    res.status(500).json({ error: "Sunucu hatası" });
  }
};
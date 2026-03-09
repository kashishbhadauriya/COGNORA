require("dotenv").config();
const fs = require("fs");
const express = require('express');
const mongoose = require('mongoose');
const User = require('./models/user');

const multer = require("multer");
const pdfParse = require("pdf-parse");
const Groq = require("groq-sdk");
const Tesseract = require("tesseract.js");
const Summary = require("./models/summary");
const Quiz = require("./models/quiz");
const Doubt = require("./models/doubt");


const app = express();
const port = 3000;
const upload = multer({ storage: multer.memoryStorage() });
app.set("view engine", "ejs");
app.set("views", "./views");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static('public'));


// MongoDB connection
mongoose.connect('mongodb://localhost:27017/studyapp')
.then(() => console.log('MongoDB connected'))
.catch(err => console.log(err));


const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});



app.get('/', (req, res) => {
  res.render('login');
});
app.get('/signup', (req, res) => {
  res.render('signup');
});
app.get('/dashboard', (req, res) => {
  res.render('dashboard');
}
);

app.post("/login", async (req, res) => {


  const { username, password } = req.body;

  const user = await User.findOne({ username });

  if (!user) {
    return res.send("User not found");
  }

  if (user.password === password) {
    return res.redirect("/dashboard");
  }

  res.send("Invalid Password");

});
app.post("/signup", async (req, res) => {
  const { username, email, password } = req.body;
  const newUser = new User({
    username,
    email,
    password,
    createdAt: new Date(),
    views: 0,
    
  });
  await newUser.save();
  console.log(await User.find());
  res.redirect('/dashboard');

});


app.get("/summarize",(req,res)=>{
res.render("summarize",{summary: null});
});


app.post("/summarize", upload.single("file"), async (req,res)=>{
try {
let text = "";
if(!req.file){
return res.send("No file uploaded");
}
const fileBuffer = req.file.buffer;
const fileType = req.file.mimetype;
if(fileType === "application/pdf"){
const data = await pdfParse(fileBuffer);
text = data.text;
}
else if(fileType.startsWith("image/")){
const result = await Tesseract.recognize(fileBuffer,"eng");
text = result.data.text;
}
else{
return res.send("Unsupported file format");
}
text = text.slice(0,4000);
const completion = await groq.chat.completions.create({
model: "llama-3.3-70b-versatile",
messages: [
{
role: "user",
content: `Summarize this document in short bullet points:\n\n${text}`
}
]
});
const summary = completion.choices[0].message.content;
await Summary.create({
    filename: req.file.originalname,
originalText: text,
summary: summary
});

res.render("summarize",{summary});
}
catch(err){
console.log(err);
res.send("Error summarizing file");
}
});

app.get("/quiz",(req,res)=>{
res.render("quiz",{quiz: null});
}
);
app.post("/quiz", upload.single("file"), async (req, res) => {
try {
  const fileBuffer = req.file.buffer;
const pdfData = await pdfParse(fileBuffer);
const text=pdfData.text.substring(0,4000);
const response = await groq.chat.completions.create({
model: "llama-3.3-70b-versatile",
messages: [
{
role: "user",
content: `Generate summary and 5 quiz questions (with answers) from this text:\n\n${text}`
}
],
});
const quiz = response.choices[0].message.content;
await Quiz.create({
filename: req.file.originalname,
quizText: quiz
});

res.render("quiz",{quiz});
} catch (error) {
console.log(error);
res.send("Error generating quiz");
}
});


app.get("/doubt", (req, res) => {
  res.render("doubt", { answer: null, question: "" });
});
app.post("/doubt", async (req, res) => {

try{

const question = req.body.question;

const prompt = `
You are an AI tutor helping a student understand concepts clearly.

Explain the following question in a structured and easy way.

Use this format:
## Concept
Explain the concept clearly in simple words.

## Key Points
- Important idea 1
- Important idea 2
- Important idea 3

## Example
Give a simple example if possible.

## Summary
Short 1–2 line recap.

Question:
${question}
`;

const response = await groq.chat.completions.create({
messages:[{ role:"user", content: prompt }],
model:"llama-3.1-8b-instant"
});

const answer = response.choices[0].message.content;
await Doubt.create({ question, answer });


res.render("doubt",{ answer, question });

}catch(err){

console.log(err);
res.send("Error generating answer");
}
});



app.get("/notes", async (req, res) => {

const summaries = await Summary.find().sort({ createdAt: -1 }).limit(10);

const quizzes = await Quiz.find().sort({ createdAt: -1 }).limit(10);

const doubts = await Doubt.find().sort({ createdAt: -1 }).limit(10);

res.render("notes", {
summaries,
quizzes,
doubts
});

});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
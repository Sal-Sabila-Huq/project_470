
const express = require('express');
const mysql = require('mysql2/promise'); // পরিবর্তন: promise wrapper ব্যবহার করা হয়েছে
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const app = express();
const multer = require('multer');
//================================  multer configuration for img management : =================================



// const path = require('path');
const fs = require('fs');

// ফোল্ডার পাথটি ঠিক করো
const uploadDir = path.join(__dirname, 'public', 'uploads', 'posts');

// যদি ফোল্ডার না থাকে তবে তৈরি করার লজিক (নিরাপত্তার জন্য)
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir); // এখানে ভেরিয়েবলটি ব্যবহার করো
    },
    filename: (req, file, cb) => {
        cb(null, 'post-' + Date.now() + path.extname(file.originalname));
    }
});





const upload = multer({ 
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // সহজভাবে 100 এমবি সেট করা হলো
}).single('post_image');






//========================================== middlewire configuration : ===============================


app.use(cors({
    origin: "*", 
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// this middle wire will show your public folder where your images are stored it whill tell the server to show the public folder.
app.use('/public', express.static(path.join(__dirname, 'public')));




// this line will show you .html files to the server.
app.use(express.static(__dirname));





// Database Connection
// let db;

// async function connectDB() {
//     try {
//         db = await mysql.createPool({ // createConnection এর বদলে createPool বেশি নিরাপদ
//             host: 'localhost',
//             user: 'root',
//             password: '',
//             database: 'auth_db',
//             waitForConnections: true,
//             connectionLimit: 10,
//             queueLimit: 0
//         });
//         console.log("Connected to MySQL Database!");
//     } catch (err) {
//         console.log("Database connection failed: " + err.message);
//     }
// }
// connectDB();


let db;

async function connectDB() {
    try {
        // createPool এর আগে await দরকার নেই, কারণ এটি সরাসরি পুল তৈরি করে
        db = mysql.createPool({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'auth_db',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        // কানেকশনটি আসলে ঠিক আছে কি না তা পরীক্ষা করার জন্য একটি টেস্ট কুয়েরি
        await db.getConnection(); 
        console.log("✅ Connected to MySQL Database using Pool (Promise)!");
        
    } catch (err) {
        console.error("❌ Database connection failed: " + err.message);
    }
}

connectDB();






// --- File Routes ---

app.get('/', (req, res) => {
    const filePath = path.join(__dirname, './home.html');
    res.sendFile(filePath, (err) => {
        if (err) {
            console.log("Error sending file:", err);
            res.status(500).send("সার্ভার ফাইলটি খুঁজে পাচ্ছে না! নিশ্চিত করো তোমার login.html ফাইলটি server.js এর পাশেই আছে।");
        }
    });
});

// Admin ও User পেজের জন্য আলাদা রাউট
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/user', (req, res) => {
    res.sendFile(path.join(__dirname, 'user.html'));
});

// --- API Routes (তোমার আগের কোড) ---
app.post('/register', async (req, res) => {
    const { username, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const sql = "INSERT INTO users (username, password, role) VALUES (?, ?, ?)";
    try {
        await db.query(sql, [username, hashedPassword, role]);
        res.status(201).json({ message: "User Registered Successfully!" });
    } catch (err) {
        return res.status(500).json({ error: "User already exists!" });
    }
});



// login post api route
// server.js এর লগইন রাউটটি এইভাবে আপডেট করো
app.post('/login', async (req, res) => { // async যোগ করা হয়েছে
    
    const { username, password } = req.body;
    
    const sql = "SELECT * FROM users WHERE username = ?";

    try {
        const [results] = await db.query(sql, [username]);
        if (results.length === 0) return res.status(404).json({ error: "User not found!" });

        const user = results[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) return res.status(401).json({ error: "Wrong Password!" });

        const token = jwt.sign({ id: user.id, role: user.role }, "SECRET_KEY", { expiresIn: '1h' });
      
        
        // এখানে mess_id রেসপন্সে যোগ করা হয়েছে
        res.json({ 
            message: "Login Successful", 
            token, 
            id: user.id, 
            role: user.role,
            mess_id: user.mess_id,
            profile_pic:user.profile_pic,
            username:user.username
        });
        



    } catch (err) {
     
        res.status(500).json({ error: "Database error" });
    }
});














// ============================================================     user interface ============================================


// প্রোফাইল পিকচারের জন্য ফোল্ডার পাথ
const profileDir = path.join(__dirname, 'public', 'uploads', 'profiles');
if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true });
}

// প্রোফাইলের জন্য আলাদা স্টোরেজ ইঞ্জিন
const profileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, profileDir);
    },
    filename: (req, file, cb) => {
        // ইউজারের আইডি পাওয়া গেলে সেটা দিয়ে নাম করা ভালো, আপাতত টাইমস্ট্যাম্প দিচ্ছি
        cb(null, 'profile-' + Date.now() + path.extname(file.originalname));
    }
});

const uploadProfile = multer({ 
    storage: profileStorage,
    limits: { fileSize: 100 * 1024 * 1024 } 
}).single('profile_pic');

// প্রোফাইল পিকচার আপলোড API এন্ডপয়েন্ট
app.post('/api/upload-profile-pic', uploadProfile, async (req, res) => {
    try {
        const { userId } = req.body;
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

        const imagePath = `/public/uploads/profiles/${req.file.filename}`;
        
        // ডাটাবেস আপডেট কুয়েরি
        const [result] = await db.query(
            "UPDATE users SET profile_pic = ? WHERE id = ?",
            [imagePath, userId]
        );


        res.status(200).json({ 
            success: true, 
            message: 'Uploaded successfully', 
            imagePath: imagePath 
        });



    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// fetching user picture in the profile picture : 
// Example: গেট ইউজার ডেটা
app.get('/api/user/:id', async (req, res) => {
    const [rows] = await db.query("SELECT username, profile_pic FROM users WHERE id = ?", [req.params.id]);
    res.json(rows[0]);
});










// for bazar _logs : user interface : 

// user's bazar first a pending bazar list a  jabe 
// then admin approve korle bazar main database a jabe..
// 


// 

app.post('/api/submit-bazar', async (req, res) => {
    // ফ্রন্টএন্ড থেকে messId আসছে, তাই এখানে messId ধরছি
    const { user_id, messId, username, bazar_date, items, total_price } = req.body;
    
    // আইটেম অ্যারে থাকলে স্ট্রিং বানিয়ে নেওয়া
    const itemsString = Array.isArray(items) ? items.join(', ') : items;

    // কলামের নাম অবশ্যই 'items' হতে হবে, 'itemsString' নয়
    const sql = "INSERT INTO pending_bazar (user_id, mess_id, username, bazar_date, items, total_price) VALUES (?, ?, ?, ?, ?, ?)";
    
    try {
        // এখানে messId পাস করো
        await db.query(sql, [user_id, messId, username, bazar_date, itemsString, total_price]);
        res.status(201).json({ message: "Bazar added successfully! Please wait for admin's approval !!" });
    } catch (err) {
        console.error("Database Error:", err);
        return res.status(500).json({ error: "Failed to store bazar data!" });
    }
});


// fetching pending bazar for admin : 
app.get('/api/get-pending-bazar/:messId', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM pending_bazar WHERE mess_id = ? AND status = 'pending'", [req.params.messId]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// bazar approve or deny from the admin : 

app.post('/api/approve-bazar', async (req, res) => {
    const { id, user_id, mess_id, bazar_date, items, total_price } = req.body;
    try {
        // মেইন বাজার লগে ইনসার্ট
        await db.query("INSERT INTO bazar_logs (user_id, mess_id, bazar_date, items, total_price) VALUES (?, ?, ?, ?, ?)", 
        [user_id, mess_id, bazar_date, items, total_price]);

        // পেন্ডিং থেকে রিমুভ (যাতে ভ্যানিশ হয়)
        await db.query("DELETE FROM pending_bazar WHERE id = ?", [id]);

        res.json({ success: true, message: "Bazar approved and moved to logs!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});



// ৪. অ্যাডমিন যখন DENY/REJECT করবে
app.delete('/api/reject-bazar/:id', async (req, res) => {
    try {
        await db.query("DELETE FROM pending_bazar WHERE id = ?", [req.params.id]);
        res.json({ success: true, message: "Bazar request rejected!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});








// ১. বাজার যোগ করা (টেবিল নাম bazar_logs নিশ্চিত করো)


app.post('/add-bazar', async (req, res) => {
    const { user_id, messId, bazar_date, items, total_price } = req.body;

    // আইটেমগুলো অ্যারে হলে কমা দিয়ে স্ট্রিং বানিয়ে নেওয়া
    const itemsString = Array.isArray(items) ? items.join(', ') : items;

    // ভুল ছিল এখানে: কলাম ৫টি কিন্তু '?' ছিল ৪টি। আর mess_id হবে ডাটাবেস অনুযায়ী।
    const sql = "INSERT INTO bazar_logs (user_id, mess_id, bazar_date, items, total_price) VALUES (?, ?, ?, ?, ?)";
    
    try {
        // ৫টি প্যারামিটারই পাঠাতে হবে
        await db.query(sql, [user_id, messId, bazar_date, itemsString, total_price]);
        res.status(201).json({ message: "Bazar added successfully!" });
    } catch (err) {
        console.error("Database Error:", err);
        return res.status(500).json({ error: "Failed to store bazar data!" });
    }
});










// ২. নিজের বাজার দেখা (বদলানো হয়েছে: bazars -> bazar_logs)
app.get('/my-bazar/:userId', async (req, res) => {
    const userId = req.params.userId;
    const sql = "SELECT * FROM bazar_logs WHERE user_id = ? ORDER BY bazar_date DESC";
    
    try {
        const [results] = await db.query(sql, [userId]);
        const formattedResults = results.map(row => ({
            ...row,
            items: row.items ? row.items.split(', ') : []
        }));
        res.json(formattedResults);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ৩. টোটাল বাজার (JOIN ব্যবহার করা হয়েছে যাতে username পাওয়া যায়)
app.get('/total-bazar', async (req, res) => {
    // এখানে bazar_logs এর সাথে users টেবিল জয়েন করা হয়েছে
    const sql = `
        SELECT b.*, u.username 
        FROM bazar_logs b 
        JOIN users u ON b.user_id = u.id 
        ORDER BY b.bazar_date DESC
    `;
    
    try {
        const [results] = await db.query(sql);
        const formattedResults = results.map(row => ({
            ...row,
            items: row.items ? row.items.split(', ') : []
        }));
        res.json(formattedResults);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});



// ============================================  showing  meal segment: ========================================         

app.post("/input_meal", async (req, res) => {
    const { user_id, date, lunch, dinner, guest } = req.body;

    if (!user_id || !date) {
        return res.status(400).json({
            status: "Invalid request. Please provide user_id and date."
        });
    }

    try {
        const query = `INSERT INTO meals (user_id, meal_date, lunch, dinner, guest) VALUES (?, ?, ?, ?, ?)`;
        const [result] = await db.query(query, [user_id, date, lunch, dinner, guest]);

        if (result.affectedRows > 0) {
            return res.status(200).json({
                status: "successful",
                message: "Meal added successfully!"
            });
        }
    } catch (error) {
        // ডুপ্লিকেট এন্ট্রি হলে কনসোলে বড় এরর না দেখিয়ে ইউজারকে মেসেজ দিন
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ // 409 মানে Conflict
                status: "duplicate",
                message: "আপনি এই তারিখের মিল অলরেডি সাবমিট করেছেন!"
            });
        }

        // অন্য কোনো সিরিয়াস এরর হলে তখন কনসোলে দেখাবে
        console.error("Database Error:", error.message);
        return res.status(500).json({
            status: "error",
            message: "ডাটাবেস সার্ভারে সমস্যা হয়েছে।"
        });
    }
});









// ====================================================  Mess creation and Mess Management ==========================================




// this part is mainly focused on home page : 

// functions are respectively : 

// create-mess 
// join-request
// cancel-request
// all-messes
// find_mess_member





app.post('/create-mess', upload, async (req, res) => {
    try {
        const { mess_name, total_seats, user_id, location } = req.body;

        // ১. বেসিক ভ্যালিডেশন
        if (!mess_name || !user_id) {
            return res.status(400).json({ error: "মেসের নাম এবং ইউজার আইডি প্রয়োজন!" });
        }

        // ২. চেক করো ইউজার অলরেডি কোনো মেসে আছে কি না
        const [existingUser] = await db.query("SELECT mess_id FROM users WHERE id = ?", [user_id]);

        if (existingUser.length > 0 && existingUser[0].mess_id !== null) {
            return res.status(400).json({ 
                error: "You have already opened a mess. You have to leave first to open another mess." 
            });
        }

        // ৩. ইমেজ হ্যান্ডেলিং
        let mess_img = null;
        if (req.file) {
            mess_img = `/public/uploads/posts/${req.file.filename}`;
        }

        // ৪. মেস ইনসার্ট করা
        const sqlInsertMess = "INSERT INTO messes (mess_name, admin_id, total_seats, mess_img, location, booked_seats) VALUES (?, ?, ?, ?, ?, 1)";
        
        const [result] = await db.query(sqlInsertMess, [
            mess_name, 
            user_id, 
            total_seats || 6, 
            mess_img, 
            location
        ]);

        // সঠিক চেক: mysql2/promise এ [result] দিলে result.affectedRows সরাসরি পাওয়া যায়
        if (result.affectedRows > 0) {
            console.log("Mess has created successfully");
            const newMessId = result.insertId;

            // ৫. ইউজারকে অ্যাডমিন হিসেবে আপগ্রেড করা এবং মেস আইডি সেট করা
            const sqlUpdateUser = "UPDATE users SET role = 'admin', mess_id = ? WHERE id = ?";
            const [result1] = await db.query(sqlUpdateUser, [newMessId, user_id]);

            if (result1.affectedRows > 0) {
                console.log("User data updated to admin");
                return res.status(201).json({ 
                    message: "Congratulations!! Your mess has been created, and you are the admin.",
                    mess_id: newMessId 
                });
            } else {
                throw new Error("Failed to update user role to admin");
            }

        } else {
            return res.status(500).json({ error: "Facing problem creating mess" });
        }

    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: "This mess name or admin already exists!" });
        }
        console.error("Error:", err);
        return res.status(500).json({ error: "Server error during mess creation!" });
    }
});











// getting requests from the users : 
// ১. জয়েন রিকোয়েস্ট পাঠানোর এপিআই (লজিক ফিক্সড)
app.post('/join-request', async (req, res) => {
    const { user_id, mess_id } = req.body;

    try {
        // চেক করা ইউজার আগে থেকেই কোনো মেসের সদস্য কি না
        const checkUser = "SELECT mess_id FROM users WHERE id = ?";
        const [results] = await db.query(checkUser, [user_id]);

        // সুরক্ষিত চেক: রেজাল্ট আছে কি না এবং mess_id আছে কি না
        if (results.length > 0 && results[0].mess_id) {
            return res.status(400).json({ error: "আপনি ইতিমধ্যে একটি মেসের সদস্য!" });
        }

        // রিকোয়েস্ট ইনসার্ট করা (Status: pending সহ)
        const sql = "INSERT INTO join_requests (user_id, mess_id, status) VALUES (?, ?, 'pending')";
        await db.query(sql, [user_id, mess_id]);
        res.status(200).json({ message: "রিকোয়েস্ট সফলভাবে পাঠানো হয়েছে! অ্যাডমিনের অনুমোদনের অপেক্ষা করুন।" });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "রিকোয়েস্ট পাঠাতে সমস্যা হয়েছে।" });
    }
});







// রাউটটি এখন 'delete' মেথড এবং প্যারামিটার গ্রহণ করবে
app.delete('/cancel-request/:userId/:messId', async (req, res) => {
    try {
        const { userId, messId } = req.params; // বডির বদলে প্যারামস থেকে ডাটা নিচ্ছি

        const sqlDelete = "DELETE FROM join_requests WHERE user_id = ? AND mess_id = ? AND status = 'pending'";
        const [result] = await db.query(sqlDelete, [userId, messId]);

        if (result.affectedRows > 0) {
            res.json({ message: "Request cancelled successfully!" });
        } else {
            res.status(404).json({ error: "No pending request found!" });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server Error!" });
    }
});









// সব মেসের তথ্য ডেটাবেস থেকে নিয়ে আসা
app.get('/all-messes', async (req, res) => {

    const sql = "SELECT messes.*, users.username AS admin_name,users.id As admin_id FROM messes JOIN users ON messes.admin_id = users.id ORDER BY messes.id DESC"

    try {
        const [results] = await db.query(sql);
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});





// for the home page  :  Mess backend :  for the home page :  

app.get("/find_mess_member", async (req, res) => {
    const userId = req.query.userId;

    // যদি userId পাঠানোই না হয় (যেমন কোড ভুল থাকলে), তখন শুধু এরর দেবে
    if (!userId) {
        return res.status(200).json({ mess_id: null, message: "No user ID provided" });
    }

    const query = "SELECT mess_id FROM users WHERE id = ?";
    try {
        const [rows] = await db.query(query, [userId]);

        if (rows.length > 0) {
            // ইউজার মেসে থাকুক বা না থাকুক, আমরা শুধু ডাটা পাঠাব
            // মেসে না থাকলে rows[0].mess_id এর মান অটোমেটিক NULL হবে
            return res.status(200).json({ 
                mess_id: rows[0].mess_id,
                isMember: rows[0].mess_id !== null 
            });
        } else {
            // ইউজারই যদি ডাটাবেসে না থাকে
            return res.status(200).json({ mess_id: null });
        }
    } catch (error) {
        console.error("Database error:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});




// =========================================  mess interface : =====================================================

app.get("/get_today_meal_data", async (req, res) => {
    try {
        // আজকের তারিখ (YYYY-MM-DD)
        const today = new Date().toISOString().split('T')[0]; 
        const messId = req.query.messId;

        

        const query = `
            SELECT 
                u.id, 
                u.username, 
                IFNULL(m.lunch, 0) AS lunch, 
                IFNULL(m.dinner, 0) AS dinner, 
                IFNULL(m.guest, 0) AS guest 
            FROM users u
            LEFT JOIN meals m ON u.id = m.user_id AND m.meal_date = ?
            WHERE u.mess_id = ?
        `;

        // mysql2/promise এ [rows] আকারে ডাটা আসে
        const [rows] = await db.query(query, [today, messId]);

        

        if (rows.length > 0) {
            // res.statusCode(200) না, এটা হবে res.status(200)
            res.status(200).json(rows);
        } else {
            res.status(200).json([]); // ফাঁকা অ্যারে পাঠানোই ভালো
        }

    } catch (err) {
        console.error("Error in /get_today_meal_data:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});



// Getting meal data : 


app.get("/api/get_mealrate", async (req, res) => {
    try {
        

        const messId = parseInt(req.query.messId); // সংখ্যায় কনভার্ট করে নাও
        
        if (!messId) {
            return res.status(400).json({ error: "Mess ID is required !! please login another time !!" });
        }



        
        // বর্তমান সময় থেকে মাস আর বছর বের করা
        const now = new Date();
        const m = now.getMonth() + 1; // ফেব্রুয়ারি = 2
        const y = now.getFullYear();  // 2026

        // ১. টোটাল বাজার (শুধু চলতি মাসের)
        const bazarQuery = `
            SELECT SUM(total_price) as totalBazar 
            FROM bazar_logs 
            WHERE mess_id = ? 
            AND MONTH(bazar_date) = ? 
            AND YEAR(bazar_date) = ?`;
        
        // ২. টোটাল মিল (শুধু চলতি মাসের)
        const mealQuery = `
            SELECT SUM(m.lunch + m.dinner + m.guest) as totalMeals 
            FROM meals m
            JOIN users u ON m.user_id = u.id
            WHERE u.mess_id = ? 
            AND MONTH(m.meal_date) = ? 
            AND YEAR(m.meal_date) = ?`;

        const [bazarRes] = await db.query(bazarQuery, [messId, m, y]);
        const [mealRes] = await db.query(mealQuery, [messId, m, y]);

        const totalBazar = bazarRes[0].totalBazar || 0;
        const totalMeals = mealRes[0].totalMeals || 0;

        let mealRate = 0;
        if (totalMeals > 0) {
            mealRate = (totalBazar / totalMeals).toFixed(2);
        }

        res.status(200).json({
            currentMonth: m,
            totalBazar,
            totalMeals,
            mealRate
        });

    } catch (err) {
        console.error("Meal Rate Error:", err);
        res.status(500).json({ error: "Calculation failed" });
    }
});

















// =========================================  User history : =================================================================



// bookign days for rental : 

app.post("/create-booking", async (req, res) => {
    const { post_id, user_id, start_date, end_date, total_price } = req.body;

    if (!post_id || !user_id || !start_date || !end_date) {
        return res.status(400).json({ success: false, message: "All fields are required!" });
    }

    try {
        // ১. কনফ্লিক্ট চেক: এই তারিখের মধ্যে অলরেডি কোনো কনফার্মড বুকিং আছে কি না?
        const conflictSql = `
            SELECT id FROM rental_bookings 
            WHERE post_id = ? 
            AND status = 'confirmed'
            AND (
                (start_date <= ? AND end_date >= ?) 
            )`;
        
        const [conflicts] = await db.query(conflictSql, [post_id, end_date, start_date]);

        if (conflicts.length > 0) {
            return res.status(400).json({ success: false, message: "❌ Sorry, these dates are already booked!" });
        }

        // ২. বুকিং ইনসার্ট করা (এখানে 'confirmed' বদলে 'pending' করে দিলাম)
        const insertSql = `
            INSERT INTO rental_bookings (post_id, user_id, start_date, end_date, total_price, status) 
            VALUES (?, ?, ?, ?, ?, 'pending')`; // এখন ডিফল্টভাবে ওনারের কাছে রিকোয়েস্ট যাবে
        
        const [result] = await db.query(insertSql, [post_id, user_id, start_date, end_date, total_price]);

        if (result.insertId) {
            res.json({ success: true, message: "⏳ Booking request sent! Waiting for owner approval.", bookingId: result.insertId });
        } else {
            res.status(500).json({ success: false, message: "Database insertion failed!" });
        }

    } catch (err) {
        console.error("Booking Error:", err);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
});




// Rental calender and getting the booking dates :

app.get('/get-bookings/:postId', async (req, res) => {
    const { postId } = req.params;
    const query = "SELECT start_date, end_date FROM rental_bookings WHERE post_id = ? AND status = 'confirmed'";

    try {
        // mysql2 promise library হলে এটাই বেস্ট ওয়ে
        const [results] = await db.query(query, [postId]);

        if (!results || results.length === 0) {
            return res.json({ success: true, occupiedDates: [] });
        }

        let allOccupiedDates = [];

        results.forEach(booking => {
            // সরাসরি স্ট্রিং থেকে ডেট অবজেক্ট তৈরি করা
            let current = new Date(booking.start_date);
            let end = new Date(booking.end_date);
            
            // লুপ চলার সময় টাইমজোন ইস্যু এড়াতে offset ফিক্স করা ভালো
            while (current <= end) {
                // ISO স্ট্রিং নিলে অনেক সময় এক দিন পিছিয়ে যায়, তাই ম্যানুয়াল ফরম্যাট বা এই ট্রিক:
                const year = current.getFullYear();
                const month = String(current.getMonth() + 1).padStart(2, '0');
                const day = String(current.getDate()).padStart(2, '0');
                allOccupiedDates.push(`${year}-${month}-${day}`);
                
                current.setDate(current.getDate() + 1);
            }
        });

        // ডুপ্লিকেট ডেট থাকলে রিমুভ করে দেওয়া (যদি ওভারল্যাপ থাকে)
        const uniqueDates = [...new Set(allOccupiedDates)];

        res.status(200).json({ 
            success: true, 
            occupiedDates: uniqueDates 
        });

    } catch (error) {
        console.error("Database Error:", error);
        res.status(500).json({ 
            success: false, 
            message: "সার্ভারে সমস্যা হয়েছে!",
            error: error.message 
        });
    }
});








// getting total meal cost , total meal and counting incoming rental requests : 


app.get("/user_meal_summary/:userId", async (req, res) => {
    const userId = req.params.userId;
    const currentMonth = new Date().toISOString().slice(0, 7); // "2026-01"

    try {
        // ইউজারের মোট মিল (এই মাসের)
        const [userMealResult] = await db.query(
            `SELECT SUM(lunch + dinner + guest) AS total FROM meals WHERE user_id = ? AND meal_date LIKE ?`, 
            [userId, `${currentMonth}%`]
        );
        const userTotalMeals = parseFloat(userMealResult[0].total) || 0;

        // পুরো মেসের মোট মিল
        const [messMealsResult] = await db.query(
            `SELECT SUM(lunch + dinner + guest) AS total FROM meals WHERE meal_date LIKE ?`, 
            [`${currentMonth}%`]
        );
        const messTotalMeals = parseFloat(messMealsResult[0].total) || 0;

        // পুরো মেসের মোট বাজার (bazar_date এবং total_price কলাম অনুযায়ী)
        const [messBazarResult] = await db.query(
            `SELECT SUM(total_price) AS total FROM bazar_logs WHERE bazar_date LIKE ?`, 
            [`${currentMonth}%`]
        );
        const messTotalBazar = parseFloat(messBazarResult[0].total) || 0;

        // ক্যালকুলেশন
        let mealRate = 0;
        if (messTotalMeals > 0) {
            mealRate = messTotalBazar / messTotalMeals;
        }
        const userCost = userTotalMeals * mealRate;

        // পেন্ডিং রিকোয়েস্ট কাউন্ট
        const [reqResult] = await db.query(
            `SELECT COUNT(*) AS count FROM rental_bookings rb 
             JOIN mess_posts mp ON rb.post_id = mp.id 
             WHERE mp.user_id = ? AND rb.status = 'pending'`, [userId]
        );

        res.json({
            success: true,
            totalMeals: userTotalMeals,
            mealRate: mealRate.toFixed(2),
            userCost: userCost.toFixed(2),
            pendingRequests: reqResult[0].count || 0
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Database error" });
    }
});




app.get("/incoming-requests/:userId", async (req, res) => {
    const ownerId = req.params.userId;
    try {
        const sql = `
            SELECT 
                rb.id, 
                u.username AS sender_name, 
                NULL AS profile_pic, 
                mp.title AS mess_name, 
                rb.total_price AS amount,
                rb.status,
                -- এই লাইন দুটি ভালো করে দেখো, AS ব্যবহার করা হয়েছে
                DATE_FORMAT(rb.start_date, '%d %b') AS start_date, 
                DATE_FORMAT(rb.end_date, '%d %b') AS end_date
            FROM rental_bookings rb
            JOIN mess_posts mp ON rb.post_id = mp.id
            JOIN users u ON rb.user_id = u.id
            WHERE mp.user_id = ? 
            AND LOWER(rb.status) = 'pending'`;

        const [requests] = await db.query(sql, [ownerId]);
        res.json({ success: true, requests });
    } catch (err) {
        res.status(500).json({ success: false, message: "Database error" });
    }
});














// reject a user from rental request :    updating 


app.put("/update-booking-status/:bookingId", async (req, res) => {
    const { bookingId } = req.params;
    const { status } = req.body;

    try {
        // ১. যদি ওনার একসেপ্ট করেন (Confirmed)
        if (status === 'confirmed') {
            // প্রথমে এই বুকিংয়ের বিস্তারিত (post_id, dates) বের করে আনা
            const [currentBooking] = await db.query(
                "SELECT post_id, start_date, end_date FROM rental_bookings WHERE id = ?", 
                [bookingId]
            );

            if (currentBooking.length > 0) {
                const { post_id, start_date, end_date } = currentBooking[0];

                // ২. একই সময়ে ওই প্রোডাক্টের অন্য সব 'pending' রিকোয়েস্টকে অটো-ক্যান্সেল করে দেওয়া
                const cancelSql = `
                    UPDATE rental_bookings 
                    SET status = 'cancelled' 
                    WHERE post_id = ? 
                    AND status = 'pending' 
                    AND id != ? 
                    AND (
                        (start_date <= ? AND end_date >= ?)
                    )`;
                
                // এখানে কনফ্লিক্ট চেক করে বাকিগুলো বাতিল করছি
                await db.query(cancelSql, [post_id, bookingId, end_date, start_date]);
            }
        }

        // ৩. মেইন বুকিং স্ট্যাটাস আপডেট করা (Accept অথবা Reject)
        const sql = `UPDATE rental_bookings SET status = ? WHERE id = ?`;
        await db.query(sql, [status, bookingId]);

        res.json({ 
            success: true, 
            message: status === 'confirmed' ? "Booking confirmed and conflicting requests cancelled!" : "Booking updated!" 
        });

    } catch (err) {
        console.error("Conflict Resolution Error:", err);
        res.status(500).json({ success: false, message: "Server error during update" });
    }
});




app.get("/user-rental-history/:userId", async (req, res) => {
    const userId = req.params.userId;
    try {
        const sql = `
            SELECT 
                mp.title, -- আমরা আবার টাইটেল ফিরিয়ে আনলাম
                CONCAT(DATE_FORMAT(rb.start_date, '%d %b'), ' - ', DATE_FORMAT(rb.end_date, '%d %b')) AS dates, 
                rb.total_price AS amount, 
                rb.status
            FROM rental_bookings rb
            JOIN mess_posts mp ON rb.post_id = mp.id
            WHERE rb.user_id = ?
            ORDER BY rb.created_at DESC`;
        
        const [history] = await db.query(sql, [userId]);
        res.json({ success: true, history });
    } catch (err) {
        console.error("History Error:", err);
        res.status(500).json({ success: false });
    }
});



























// ===============================================================  Admin part : ================================================












// to the admin : admin will see the request: 


app.get('/pending-requests/:mess_id', async (req, res) => {
    const messId = req.params.mess_id;
    const sql = `
        SELECT 
            jr.id, 
            u.id AS user_id, 
            u.username, 
            u.profile_pic, 
            jr.request_date 
        FROM join_requests jr
        JOIN users u ON jr.user_id = u.id
        WHERE jr.mess_id = ? AND jr.status = 'pending'
    `;
    
    try {
        const [results] = await db.query(sql, [messId]);

        // যদি কোনো রিকোয়েস্ট খুঁজে পাওয়া না যায়
        // it's a very normal thing that there is no pending requests to show !!
        if (!results || results.length === 0) {
            return res.status(200).json([]); // ২-০-০ ওকে সাথে খালি অ্যারে
        }

        // প্রোফাইল পিকচার হ্যান্ডেল করা
        const updatedResults = results.map(user => ({
            ...user,
            profile_pic: user.profile_pic || '/public/uploads/profiles/default-avatar.png'
        }));

        res.status(200).json(updatedResults);

    } catch (err) {
        console.error("Database Error:", err);
        res.status(500).json({ 
            success: false, 
            error: "সার্ভারে সমস্যা হয়েছে, আবার চেষ্টা করো।" 
        });
    }
});










// approval : from the admin :             approval from the admin : 

// ৩. রিকোয়েস্ট একসেপ্ট করার এপিআই
// তোমার server.js এর এই অংশটুকু একটু চেক করে নাও
app.post('/accept-request', async (req, res) => {
    const { request_id, user_id, mess_id } = req.body;

    try {
        // ১. রিকোয়েস্ট আপডেট করা (Accepted স্ট্যাটাস)
        const sql1 = "UPDATE join_requests SET status = 'accepted' WHERE id = ?";
        await db.query(sql1, [request_id]);

        // ২. ইউজারের মেস আইডি সেট করা
        const sql2 = "UPDATE users SET mess_id = ? WHERE id = ?";
        await db.query(sql2, [mess_id, user_id]);

        // ৩. মেসের বুকড সিট সংখ্যা বাড়ানো
        const sql3 = "UPDATE messes SET booked_seats = booked_seats + 1 WHERE id = ?";
        await db.query(sql3, [mess_id]);

        res.json({ message: "সদস্য সফলভাবে যুক্ত করা হয়েছে! 🎉" });
    } catch (err) {
        return res.status(500).json({ error: "Accept request process failed" });
    }
});




// request deletion : 

app.delete('/reject-request/:id', async (req, res) => {
    const requestId = req.params.id;
    const sql = "DELETE FROM join_requests WHERE id = ?";
    try {
        await db.query(sql, [requestId]);
        res.json({ message: "রিকোয়েস্টটি বাতিল করা হয়েছে।" });
    } catch (err) {
        return res.status(500).json({ error: "Reject failed" });
    }
});





// seeing mess members : 

app.get('/mess-members/:mess_id', async (req, res) => {
    const messId = req.params.mess_id;
    // profile_pic যোগ করা হয়েছে
    const sql = ` SELECT 
                u.id, 
                u.username, 
                u.role, 
                u.profile_pic, 
                m.mess_name 
            FROM users u
            JOIN messes m ON u.mess_id = m.id
            WHERE u.mess_id = ?`;
    try {
        const [results] = await db.query(sql, [messId]);
        
        if (!results || results.length === 0) {
            return res.status(404).json({ message: "No members found" });
        }

        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});



// Admin can remove messmember : 
// server.js এর ভেতর এই আপডেটটা বসাও
app.post('/remove-member', async (req, res) => {
    const { userId, messId } = req.body;

    console.log("Backend received - User:", userId, "Mess:", messId);

    if (!userId || !messId) {
        return res.status(400).json({ success: false, message: "UserId and MessId both are required!" });
    }

    try {
        // ১. ইউজারের mess_id কে NULL করে দাও
        const updateUserSql = "UPDATE users SET mess_id = NULL WHERE id = ?";
        const [userResult] = await db.query(updateUserSql, [userId]);

        console.log("User Table Update Result:", userResult.affectedRows);

        // ২. মেসেস টেবিল থেকে booked_seats ১ কমিয়ে দাও
        // এখানে id = ? মানে হচ্ছে তোমার মেসেসের আইডি
        const updateMessSql = "UPDATE messes SET booked_seats = booked_seats - 1 WHERE id = ?";
        const [messResult] = await db.query(updateMessSql, [messId]);

        console.log("Mess Table Update Result:", messResult.affectedRows);

        if (userResult.affectedRows > 0) {
            res.json({ 
                success: true, 
                message: "Member removed and seat updated!" 
            });
        } else {
            res.status(404).json({ 
                success: false, 
                message: "User not found or ID incorrect!" 
            });
        }

    } catch (error) {
        console.error("Critical Database Error:", error);
        res.status(500).json({ 
            success: false, 
            message: "Database failure: " + error.message 
        });
    }
});























// ============================================================= create post manage : =====================================================



app.post("/create-posts", (req, res) => {
    // ১. প্রথমে ইমেজ আপলোড ফাংশন কল করো
    upload(req, res, async (err) => {
        if (err) {
            console.error("Multer Error:", err);
            return res.status(500).json({ error: "Image upload failed: " + err.message });
        }

        try {
            // ২. রিকোয়েস্ট বডি থেকে ডাটা নাও
            const { user_id, post_type, title, description, price } = req.body;

            // ৩. ইমেজ পাথ তৈরি (এখানেই আমরা /public যোগ করছি)
            // যেহেতু তোমার ফোল্ডার স্ট্রাকচার /public/uploads/posts/
            const image_path = req.file ? `/public/uploads/posts/${req.file.filename}` : null;

            // ৪. প্রাইস লজিক (যদি টাইপ 'other' হয় তবে প্রাইস ০ হবে)
            const finalPrice = (post_type === 'other') ? 0 : price;

            // ৫. ডাটাবেস কুয়েরি
            const sql = "INSERT INTO mess_posts (user_id, post_type, title, description, price, image_path) VALUES (?, ?, ?, ?, ?, ?)";
            
            const [result] = await db.query(sql, [user_id, post_type, title, description, finalPrice, image_path]);

            // ৬. রেসপন্স পাঠানো
            if (result.affectedRows > 0) {
                return res.status(200).json({ 
                    success: true,
                    message: "Post Created Successfully! 🚀", 
                    postId: result.insertId 
                });
            } else {
                return res.status(400).json({ error: "Could not save post." });
            }

        } catch (error) {
            console.error("Database Error:", error);
            return res.status(500).json({ error: "Internal Server Error!" });
        }
    });
});

// সব পোস্ট একসাথে পাওয়ার জন্য এপিআই (এটি ড্যাশবোর্ডের জন্য)
app.get("/get-posts", async (req, res) => {
    try {
        const sql = `
            SELECT mess_posts.*, users.username, messes.mess_name 
            FROM mess_posts 
            JOIN users ON mess_posts.user_id = users.id 
            LEFT JOIN messes ON users.mess_id = messes.id 
            ORDER BY mess_posts.id DESC`;

        const [rows] = await db.query(sql);
        res.status(200).json(rows);
    } catch (err) {
        console.error("❌ Error fetching all posts:", err.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
});



app.get("/get-post/:id", async (req, res) => {
    const postId = req.params.id;
    console.log(`🔍 Fetching details for Post ID: ${postId}...`);

    try {
        const sql = `
            SELECT mess_posts.*, users.username, messes.mess_name 
            FROM mess_posts 
            JOIN users ON mess_posts.user_id = users.id 
            LEFT JOIN messes ON users.mess_id = messes.id 
            WHERE mess_posts.id = ?`;

        const [rows] = await db.query(sql, [postId]);

        // ১. যদি ডাটাবেসে এই আইডি দিয়ে কোনো পোস্ট না থাকে
        if (rows.length === 0) {
            console.warn(`⚠️ Warning: No post found with ID: ${postId}`);
            return res.status(404).json({ error: "Sorry, this post does not exist!" });
        }

        // ২. সাকসেস হলে কনসোলে মেসেজ দাও
        console.log(`✅ Success: Post found! Title: "${rows[0].title}"`);
        res.status(200).json(rows[0]);

    } catch (err) {
        // ৩. যদি কুয়েরিতে বা সার্ভারে কোনো বড় এরর হয়
        console.error(`❌ Database Error for Post ID ${postId}:`, err.message);
        res.status(500).json({ 
            error: "Internal Server Error", 
            details: err.message 
        });
    }
});







// ====================== new features : 


app.post("/post-notice", async (req, res) => { 
    console.log("1. Backend Received:", req.body);
    
    const { notice_date, message, messId } = req.body;

    // যদি messId না আসে, তবে এরর থ্রো করবো
    if (!messId) {
        return res.status(400).send("Mess ID is required to post a notice.");
    }

    try {
        // SQL কুয়েরিতে mess_id কলামটি যোগ করা হলো
        const sql = 'INSERT INTO admin_notice (notice_date, message, mess_id) VALUES (?, ?, ?)';
        console.log("2. Attempting to run Query...");
        
        // ভ্যালুগুলো ডাটাবেসে পাঠানো হচ্ছে
        const [result] = await db.query(sql, [notice_date, message, messId]);

        if (result.affectedRows === 0) {
            console.log(`❌ Notice doesn't submit`);
            return res.status(400).send("Failed to post notice.");
        }

        console.log(`✅ Success: Notice inserted with ID: ${result.insertId}`);
        res.status(200).json({
            status: "Success",
            message: "Notice posted successfully!",
            id: result.insertId
        });

    } catch (error) {
        console.error("❌ Error running query:", error.message);
        res.status(500).send("Internal Server Error");
    }
});



app.get("/get-today-notices", async (req, res) => {
    // ফ্রন্টএন্ড থেকে পাঠানো messId রিসিভ করা
    const messId = req.query.messId; 

    if (!messId) {
        return res.status(400).json({ error: "Mess ID is required to fetch notices." });
    }

    try {
        // SQL: শুধু নির্দিষ্ট মেসের এবং আজকের তারিখের নোটিশগুলো আনবে
        const sql = 'SELECT message, created_at FROM admin_notice WHERE mess_id = ? AND notice_date = CURDATE() ORDER BY created_at DESC';
        
        // messId প্যারামিটার হিসেবে ডাটাবেসে পাঠানো হচ্ছে
        const [notices] = await db.query(sql, [messId]);
        res.status(200).json(notices);
        
    } catch (error) {
        console.error("❌ Error fetching notices:", error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
});




app.get("/api/dashboard-analytics", async (req, res) => {
    // URL থেকে messId নিচ্ছি (যেমন: /api/dashboard-analytics?messId=1)
    const messId = req.query.messId;

    if (!messId) {
        return res.status(400).json({ error: "messId is required" });
    }

    try {
        // ১. JOIN ব্যবহার করে নির্দিষ্ট মেসের মিলের ডাটা তুলে আনা
        const sql = `
            SELECT 
                DATE(m.meal_date) as meal_date, 
                SUM(m.lunch) as lunch_count, 
                SUM(m.dinner) as dinner_count, 
                SUM(m.guest) as guest_count 
            FROM meals m
            JOIN users u ON m.user_id = u.id
            WHERE u.mess_id = ?
            GROUP BY DATE(m.meal_date) 
            ORDER BY m.meal_date ASC
        `;
        
        // messId প্যারামিটার হিসেবে পাস করা হলো
        const [rows] = await db.query(sql, [messId]);
        
        console.log("----------------------------");
        console.log(`🔔 API Hit Received for Analytics (Mess ID: ${messId})`);
        console.log("Total Rows Found:", rows.length);
        console.log("----------------------------");

        // ২. বর্তমান এবং আগের মাসের ডাটা আলাদা করার লজিক (আগের মতোই থাকবে)
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth(); 
        const currentYear = currentDate.getFullYear();
        
        let currentMonthTotal = 0;
        let prevMonthTotal = 0;
        let distribution = { lunch: 0, dinner: 0, guest: 0 };
        let dailyTrend = { labels: [], data: [] };

        rows.forEach(row => {
            const rowDate = new Date(row.meal_date);
            const rowMonth = rowDate.getUTCMonth(); 
            const rowYear = rowDate.getUTCFullYear();
            
            const lunchCount = Number(row.lunch_count) || 0;
            const dinnerCount = Number(row.dinner_count) || 0;
            const guestCount = Number(row.guest_count) || 0;
            
            const totalDayMeal = lunchCount + dinnerCount + guestCount;

            if (rowMonth === currentMonth && rowYear === currentYear) {
                currentMonthTotal += totalDayMeal;
                distribution.lunch += lunchCount;
                distribution.dinner += dinnerCount;
                distribution.guest += guestCount;
                
                const displayDate = `${rowDate.getUTCDate()} ${rowDate.toLocaleString('default', { month: 'short', timeZone: 'UTC' })}`;
                dailyTrend.labels.push(displayDate);
                dailyTrend.data.push(totalDayMeal);
            }
            else if (rowMonth === currentMonth - 1 || (currentMonth === 0 && rowMonth === 11)) {
                prevMonthTotal += totalDayMeal;
            }
        });

        // ৩. Growth Calculate করা (আগের মতোই থাকবে)
        let growthPercentage = 0;
        let isPositive = true;
        
        if (prevMonthTotal > 0) {
            growthPercentage = ((currentMonthTotal - prevMonthTotal) / prevMonthTotal) * 100;
        } else if (prevMonthTotal === 0 && currentMonthTotal > 0) {
            growthPercentage = 100;
        }
        
        if (growthPercentage < 0) {
            isPositive = false;
        }

        res.status(200).json({
            distribution,
            dailyTrend,
            growth: {
                value: Math.abs(growthPercentage).toFixed(1),
                isPositive,
                currentMonthTotal
            }
        });

    } catch (error) {
        console.error("❌ Analytics Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});





// user profile : 

// user profile and analytics data fetch
app.get("/api/user-profile-analytics", async (req, res) => {
    const { userId, messId } = req.query;

    if (!userId || !messId) {
        return res.status(400).json({ error: "User ID and Mess ID are required" });
    }

    try {
        // ১. ইউজারের বেসিক ইনফরমেশন
        const [userInfo] = await db.query(
            "SELECT username, profile_pic, created_at FROM users WHERE id = ?", 
            [userId]
        );

        console.log(userInfo);

        if (userInfo.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        // ২. এই মাসের বাজার খরচ (Bazaar Cost)
        const [bazaar] = await db.query(
            "SELECT SUM(total_price) as total FROM bazar_logs WHERE user_id = ? AND MONTH(bazar_date) = MONTH(CURDATE()) AND YEAR(bazar_date) = YEAR(CURDATE())",
            [userId]
        );

        // ৩. এই মাসের নিজের মিল এবং গেস্ট মিল (Meals)
        const [meals] = await db.query(
            "SELECT SUM(lunch + dinner) as user_meals, SUM(guest) as guest_meals FROM meals WHERE user_id = ? AND MONTH(meal_date) = MONTH(CURDATE()) AND YEAR(meal_date) = YEAR(CURDATE())",
            [userId]
        );

        // ৪. মেসের বর্তমান মিল রেট বের করা (Current Meal Rate)
        const [messTotalBazaar] = await db.query(
            "SELECT SUM(total_price) as total FROM bazar_logs WHERE mess_id = ? AND MONTH(bazar_date) = MONTH(CURDATE())",
            [messId]
        );
        const [messTotalMeals] = await db.query(
            "SELECT SUM(m.lunch + m.dinner + m.guest) as total FROM meals m JOIN users u ON m.user_id = u.id WHERE u.mess_id = ? AND MONTH(m.meal_date) = MONTH(CURDATE())",
            [messId]
        );

        const totalBazaar = messTotalBazaar[0].total || 0;
        const totalMealsCount = messTotalMeals[0].total || 1; // 0 দিয়ে ভাগ এড়ানোর জন্য
        const currentMealRate = (totalBazaar / totalMealsCount).toFixed(2);

        // ৫. মান্থলি সামারি (গত ৬ মাসের বার চার্টের জন্য)
        const [history] = await db.query(
            "SELECT MONTHNAME(meal_date) as month, SUM(lunch + dinner + guest) as total FROM meals WHERE user_id = ? GROUP BY MONTH(meal_date) ORDER BY MIN(meal_date) ASC LIMIT 6",
            [userId]
        );

        // ফ্রন্টএন্ডে ডাটা পাঠানো
        res.status(200).json({
            user: userInfo[0],
            stats: {
                bazaarCost: Number(bazaar[0].total) || 0,
                userMeals: Number(meals[0].user_meals) || 0,
                guestMeals: Number(meals[0].guest_meals) || 0,
                currentMealRate: parseFloat(currentMealRate)
            },
            history: {
                labels: history.map(h => h.month.substring(0, 3)), // 'January' কে 'Jan' করবে
                values: history.map(h => Number(h.total))
            }
        });

    } catch (error) {
        console.error("❌ Profile Analytics Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});




     

app.listen(8000, () => console.log("Server running on http://localhost:8000"));







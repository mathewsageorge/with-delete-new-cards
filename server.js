// server.js
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const twilio = require('twilio');
const exceljs = require('exceljs');
const PDFDocument = require('pdfkit');
const ObjectId = mongoose.Types.ObjectId;






const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(__dirname + '/public'));
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

// MongoDB Connection
mongoose.connect('mongodb+srv://mathewsgeorge202:ansu@cluster0.ylyaonw.mongodb.net/Teachers_List?retryWrites=true&w=majority')
.then(() => console.log('MongoDB Connected'))
.catch(err => console.error('MongoDB Connection Error:', err));


// Twilio Configuration
const accountSid = 'ACc07160ca1b3e33d178f16e780fc7d96a';
const authToken = '45bc8f5c090aa60a4bf4110b4365a3c1';
const client = new twilio(accountSid, authToken);

// Handle POST request to send SMS
app.post('/send-sms', async (req, res) => {
    const { studentName } = req.body;

    if (!studentName) {
        return res.status(400).json({ error: 'Missing studentName in request body' });
    }

    // Logic to retrieve the student's phone number and send SMS using Twilio
    // Modify this part according to your implementation
    const phoneNumber = '+1234567890'; // Example phone number
    client.messages.create({
        body: 'TEST MESSAGE',
        to: '+919544461968',
        from: '+14243835712' // Your Twilio phone number
    })
    .then(message => {
        console.log('SMS sent successfully:', message.sid);
        res.sendStatus(200);
    })
    .catch(error => {
        console.error('Error sending SMS:', error);
        res.status(500).send('Failed to send SMS');
    });
});

// Define mongoose schema and model for attendance data
const attendanceSchema = new mongoose.Schema({
    serialNumber: String,
    logData: String,
    time: Date,
    period:String,
    subject:String
});

// Define mongoose schema and model for student data
const studentSchema = new mongoose.Schema({
    serialNumber: String,
    student_name: String,
    class: String,
    ph: String
});


// User Data
const users = {
    mathews: { username: 'mathews', password: '1', collection: 'mathews_records' },
    keshav: { username: 'keshav', password: '2', collection: 'abel_records' },
    ansu: { username: 'ansu', password: '3', collection: 'kevin_records' },
    neha: { username: 'neha', password: '4', collection: 'sonu_records' }
};

// Function to map serial numbers to student names
function mapSerialToStudentName(serialNumber) {
    const serialToNameMap = {
        "05:34:6a:64:26:b0:c1": "SONU",
        "05:39:01:60:06:b0:c1":"ADWIDTH",
        "05:33:96:60:06:b0:c1":"KEVIN",
        "05:33:96:60:06:b0:a1":"ABEL",
        "05:33:96:60:06:b0:d1":"Disha",
        "05:33:96:60:06:b0:e1":"JOSEPH",
        "05:33:96:60:06:b0:f1":"MERLIN"
        // Add more mappings as needed
    };
    return serialToNameMap[serialNumber] || "Unknown"; // Return student name or "Unknown" if not found
}

// Routes
app.get('/', (req, res) => {
    res.render('login');
});

// server.js

// Route for handling login and rendering dashboard with attendance and student data
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = users[username];
    if (user && user.password === password) {
        try {
            // Fetch attendance data from the MongoDB collection
            const Attendance = mongoose.model('Attendance', attendanceSchema, user.collection);
            const attendanceData = await Attendance.find({});

            // Fetch student data from the MongoDB collection
            const Student = mongoose.model('Student', studentSchema);
            const studentData = await Student.find({});

            // Extract unique periods from attendance data
            const uniquePeriods = [...new Set(attendanceData.map(data => data.period))];
            
            // Extract unique subjects from attendance data
            const uniqueSubjects = [...new Set(attendanceData.map(data => data.subject))];

            
            // Extract unique classes from student data
            const uniqueClasses = [...new Set(studentData.map(student => student.class))];
            
            // Map attendance data to include student names
            const mappedAttendanceData = attendanceData.map(data => {
                return {
                    ...data.toObject(),
                    studentName: mapSerialToStudentName(data.serialNumber),
                    logData: data.logData,
                    time: data.time,
                    period: data.period,
                    subject: data.subject,
                    serialNumber: data.serialNumber,
                    id: data._id.toString()
                };
            });

            // Render dashboard with attendance and student data
            res.render('dashboard', { 
                username: user.username, 
                students: studentData, 
                attendanceData: mappedAttendanceData, 
                periods: uniquePeriods, 
                subjects: uniqueSubjects,
                student: attendanceData,
                classes: uniqueClasses
            });
        } catch (err) {
            console.error('Error retrieving data:', err);
            res.render('error', { message: 'Error retrieving data' });
        }
    } else {
        res.render('error', { message: 'Invalid username or password' });
    }
});


app.get('/generate-excel-report', async (req, res) => {
    const { username } = req.query; // Extract username from query parameters
    const user = users[username];
    if (!user) {
        return res.status(400).send('User not found');
    }

    try {
        // Fetch attendance data from the MongoDB collection based on the logged-in user's collection
        const Attendance = mongoose.model('Attendance', attendanceSchema, user.collection);
        const attendanceData = await Attendance.find({});

        // Create a new Excel workbook and worksheet
        const workbook = new exceljs.Workbook();
        const worksheet = workbook.addWorksheet('NFC Attendance Report');

        // Define column headers
        worksheet.columns = [
            { header: 'Serial Number', key: 'serialNumber', width: 15 },
            { header: 'Log Data', key: 'logData', width: 30 },
            { header: 'Time', key: 'time', width: 20 },
            { header: 'Period', key: 'period', width: 15 },
            { header: 'Subject', key: 'subject', width: 20 },
        ];

        // Add data rows
        attendanceData.forEach(data => {
            worksheet.addRow({
                serialNumber: mapSerialToStudentName(data.serialNumber),
                logData: data.logData,
                time: data.time.toString(), // Convert date object to string
                period: data.period,
                subject: data.subject,
            });
        });

        // Generate Excel file
        const excelBuffer = await workbook.xlsx.writeBuffer();

        // Set response headers for file download
        res.setHeader('Content-Disposition', 'attachment; filename="nfc_attendance_report.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        
        // Send the Excel file as response
        res.send(excelBuffer);
    } catch (error) {
        console.error('Error generating Excel report:', error);
        res.status(500).send('Failed to generate Excel report');
    }
});


app.get('/generate-pdf-report', async (req, res) => {
    const { username } = req.query; // Extract username from query parameters
    const user = users[username];
    if (!user) {
        return res.status(400).send('User not found');
    }
    try {
        // Fetch attendance data from the MongoDB collection based on the logged-in user's collection
        const Attendance = mongoose.model('Attendance', attendanceSchema, user.collection);
        const attendanceData = await Attendance.find({});

        // Create a new PDF document
        const doc = new PDFDocument();

        // Pipe the PDF document to the response
        doc.pipe(res);

        // Add content to the PDF document
        doc.fontSize(14).text('NFC Attendance Report', { align: 'center' }).moveDown();
        attendanceData.forEach(data => {
            doc.text(`Serial Number: ${mapSerialToStudentName(data.serialNumber)}`);
            doc.text(`Log Data: ${data.logData}`);
            doc.text(`Time: ${data.time.toString()}`);
            doc.text(`Period: ${data.period}`);
            doc.text(`Subject: ${data.subject}`);
            doc.moveDown();
        });

        // Finalize the PDF document
        doc.end();
    } catch (error) {
        console.error('Error generating PDF report:', error);
        res.status(500).send('Failed to generate PDF report');
    }
});

// Handle form submission to add attendance data
app.post('/add-attendance', async (req, res) => {
    const { serialNumber, logData, time, teacher, period, subject, collection } = req.body;
  
    try {
      // Create a model for attendance data
      const Attendance = mongoose.model('Attendance', attendanceSchema, collection);
  
      // Create new attendance object
      const newAttendance = new Attendance({
        serialNumber,
        logData,
        time,
        teacher,
        period,
        subject
      });
  
      // Save attendance data to the specified collection
      await newAttendance.save();
  
      res.status(200).send('Attendance added successfully');
    } catch (error) {
      console.error('Error adding attendance:', error);
      res.status(500).send('Failed to add attendance');
    }
  });

  app.post('/delete-attendance', async (req, res) => {
    const { id, username } = req.body;
    console.log("Attempting to delete record with ID:", id); // This should log the ID

    
    // Validate ID
    if (!id || !ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: 'Invalid or missing ID' });
    }

    // Determine the collection name based on the username
    const user = users[username];
    if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }
    const collectionName = user.collection;

    // Use the attendanceSchema for the model
    // Note: Mongoose models are singular and capitalized by convention
    // Ensure the model name is unique to avoid "OverwriteModelError"
    const AttendanceModel = mongoose.model('Attendance' + collectionName, attendanceSchema, collectionName);

    try {
        // Attempt to delete the record by ID
        const result = await AttendanceModel.findByIdAndDelete(id);
        if (result) {
            res.json({ success: true, message: 'Record deleted successfully' });
        } else {
            res.status(404).json({ success: false, message: 'Record not found' });
        }
    } catch (error) {
        console.error('Failed to delete record:', error);
        res.status(500).json({ success: false, message: 'Failed to delete record' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

import { forgetPasswordModel } from "../models/forgetPasswordModel.js";
import { userModel } from "../models/userModel.js";
import nodemailer from "nodemailer";
import crypto from "crypto";
import bcrypt from "bcrypt";

export const forgetPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await userModel.findOne({ email });

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      service: process.env.SMTP_SERVICE,
      auth: {
        user: process.env.EMAIL,
        pass: process.env.PASS_KEY,
      },
    });

    const cryptoOTP = crypto.randomBytes(4).toString("hex");

    const mailOptions = {
      from: process.env.EMAIL,
      to: email,
      subject: "Verify your account!",
      html: `
                <html>
                <head>
                    <style>
                        .container {
                            font-family: Arial, sans-serif;
                            background-color: #f2f2f2;
                            padding: 20px;
                            border-radius: 5px;
                        }
                        .otp {
                            font-size: 24px;
                            font-weight: bold;
                            color: #007bff;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h3>This is an OTP for account verification purposes. Do not share this code with anyone.</h3>
                        <h3>We won't ask you to send this code to anyone.</h3>
                        <h3>Your OTP: <span class="otp">${cryptoOTP}</span></h3>
                    </div>
                </body>
                </html>
                `,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        res
          .status(400)
          .json({ message: "Error sending email", error: error.message });
      } else {
        res
          .status(200)
          .json({ message: "Email sent successfully", info: info.response });
      }
    });

    // Check for an existing record of email
    const existingRecord = await forgetPasswordModel.findOne({ email });

    if (existingRecord) {
      // Update its OTP instead of creating a new one
      existingRecord.otp = cryptoOTP;
      existingRecord.timestamp = new Date(); // Update the timestamp
      await existingRecord.save();
    }
    if (!existingRecord) {
      // If no existing record is found, create a new forgetPasswordModel
      const password = new forgetPasswordModel({
        email,
        otp: cryptoOTP,
      });

      await password.save();
    }
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

// Middleware for verifying OTP
export const verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    const forgetPass = await forgetPasswordModel.findOne({ email });

    if (forgetPass && otp === forgetPass.otp) {
      // Check if 6 hours have passed
      const currentTimestamp = new Date();
      const expirationTime = 5 * 5 * 60 * 1000; // 5 hours 5 min

      if (currentTimestamp - forgetPass.timestamp > expirationTime) {
        // OTP has expired, set OTP to undefined in the database
        forgetPass.otp = undefined;
        await forgetPass.save();

        return res.status(400).json({ message: "OTP has expired" });
      }
      return next();
    } else {
      // OTP is incorrect or email not found.
      return res
        .status(400)
        .json({ message: "OTP is incorrect or email not found" });
    }
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, newPassword, confirmPassword } = req.body;
    let user = await userModel.findOne({ email });

    if (newPassword === confirmPassword) {
      // Convert new password to hashed password
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedNewPassword;
      await user.save();
      res.status(200).json({ message: "Password updated successfully", user });
    } else {
      res.status(400).json({ message: "Passwords do not match" });
    }
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

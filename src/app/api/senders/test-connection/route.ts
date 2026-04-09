import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, service, smtp_host, smtp_port } = body;

    if (!email || !password) {
      return NextResponse.json({
        success: false,
        error: 'Email and password are required'
      }, { status: 400 });
    }

    // Configure transporter based on service type
    let transporterConfig: any;

    if (service === 'gmail') {
      transporterConfig = {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: email,
          pass: password,
        },
        // Timeout settings
        connectionTimeout: 10000,
        greetingTimeout: 5000,
        socketTimeout: 10000,
      };
    } else if (service === 'smtp') {
      transporterConfig = {
        host: smtp_host || 'smtp.gmail.com',
        port: parseInt(smtp_port) || 587,
        secure: parseInt(smtp_port) === 465, // SSL for port 465
        auth: {
          user: email,
          pass: password,
        },
        // Timeout settings
        connectionTimeout: 10000,
        greetingTimeout: 5000,
        socketTimeout: 10000,
      };
    } else {
      return NextResponse.json({
        success: false,
        error: 'Invalid service type'
      }, { status: 400 });
    }

    // Create transporter
    const transporter = nodemailer.createTransport(transporterConfig);

    // Test connection
    try {
      await transporter.verify();

      return NextResponse.json({
        success: true,
        message: 'Connection successful! The email credentials are valid.'
      });
    } catch (verifyError: any) {
      console.error('Connection verification failed:', verifyError);

      // Provide specific error messages
      let errorMessage = 'Connection failed. ';

      if (verifyError.code === 'EAUTH') {
        errorMessage += 'Authentication failed. Please check your email/password.';
      } else if (verifyError.code === 'ETIMEDOUT' || verifyError.code === 'ETIMEOUT') {
        errorMessage += 'Connection timed out. Please check your network and SMTP settings.';
      } else if (verifyError.code === 'ECONNECTION') {
        errorMessage += 'Could not connect to the SMTP server. Please check the host and port.';
      } else if (verifyError.code === 'EHOSTNOTFOUND') {
        errorMessage += 'SMTP host not found. Please check the SMTP server address.';
      } else {
        errorMessage += verifyError.message || 'Unknown error occurred.';
      }

      return NextResponse.json({
        success: false,
        error: errorMessage,
        details: verifyError.code
      });
    }
  } catch (error: any) {
    console.error('Test connection error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to test connection: ' + error.message
    }, { status: 500 });
  }
}

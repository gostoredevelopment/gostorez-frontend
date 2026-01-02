import React from 'react';
import { Link } from 'react-router-dom';

const PrivacyPolicy: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#F4F1E8] py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center mb-4">

            <span className="ml-2 text-xl font-bold text-[#9B4819]">Campus GOSTOREz</span>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
          <p className="mt-2 text-sm text-gray-600">Last updated: {new Date().toLocaleDateString()}</p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8">
          <div className="prose prose-lg max-w-none">
            {/* Introduction */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-[#9B4819] mb-4">1. Introduction</h2>
              <p className="mb-4">
                At Campus GOSTOREz, we are committed to protecting your privacy and ensuring the security of your 
                personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard 
                your information when you use our platform.
              </p>
            </section>

            {/* Information Collection */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-[#9B4819] mb-4">2. Information We Collect</h2>
              
              <h3 className="text-xl font-semibold text-gray-800 mb-3">2.1 Personal Information</h3>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Name, email address, and contact information</li>
                <li>University affiliation and student status</li>
                <li>Profile information and preferences</li>
                <li>Payment information (processed securely by third-party providers)</li>
                <li>Communication preferences</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-800 mb-3">2.2 Usage Data</h3>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>IP address and browser type</li>
                <li>Device information and operating system</li>
                <li>Pages visited and features used</li>
                <li>Transaction history and search queries</li>
              </ul>
            </section>

            {/* Use of Information */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-[#9B4819] mb-4">3. How We Use Your Information</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">Service Provision</h4>
                  <ul className="list-disc pl-4 text-sm space-y-1">
                    <li>Create and manage your account</li>
                    <li>Process transactions and payments</li>
                    <li>Provide customer support</li>
                    <li>Send service-related communications</li>
                  </ul>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">Platform Improvement</h4>
                  <ul className="list-disc pl-4 text-sm space-y-1">
                    <li>Analyze usage patterns</li>
                    <li>Develop new features</li>
                    <li>Enhance user experience</li>
                    <li>Ensure platform security</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Data Sharing */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-[#9B4819] mb-4">4. Data Sharing and Disclosure</h2>
              <p className="mb-4">
                We do not sell your personal information to third parties. We may share your information in the 
                following circumstances:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>With Vendors/Buyers:</strong> Necessary information to complete transactions</li>
                <li><strong>Service Providers:</strong> Payment processors, hosting services, analytics providers</li>
                <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
                <li><strong>Business Transfers:</strong> In connection with mergers or acquisitions</li>
              </ul>
            </section>

            {/* Data Security */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-[#9B4819] mb-4">5. Data Security</h2>
              <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
                <p className="text-blue-700">
                  We implement appropriate technical and organizational security measures to protect your 
                  personal information against unauthorized access, alteration, disclosure, or destruction.
                </p>
              </div>
              <ul className="list-disc pl-6 space-y-2">
                <li>Encryption of sensitive data in transit and at rest</li>
                <li>Regular security assessments and monitoring</li>
                <li>Access controls and authentication mechanisms</li>
                <li>Secure data storage practices</li>
              </ul>
            </section>

            {/* User Rights */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-[#9B4819] mb-4">6. Your Rights and Choices</h2>
              <div className="space-y-3">
                <p><strong>Access:</strong> You can request access to your personal information.</p>
                <p><strong>Correction:</strong> You can update or correct your information in account settings.</p>
                <p><strong>Deletion:</strong> You can request deletion of your account and personal data.</p>
                <p><strong>Opt-out:</strong> You can opt-out of marketing communications at any time.</p>
                <p><strong>Data Portability:</strong> You can request a copy of your data in a readable format.</p>
              </div>
            </section>

            {/* Cookies */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-[#9B4819] mb-4">7. Cookies and Tracking</h2>
              <p className="mb-4">
                We use cookies and similar tracking technologies to enhance your experience, analyze platform usage, 
                and deliver personalized content. You can control cookie preferences through your browser settings.
              </p>
            </section>

            {/* International Transfers */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-[#9B4819] mb-4">8. International Data Transfers</h2>
              <p className="mb-4">
                Your information may be transferred to and maintained on computers located outside of your state, 
                province, country, or other governmental jurisdiction where data protection laws may differ.
              </p>
            </section>

            {/* Children's Privacy */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-[#9B4819] mb-4">9. Children's Privacy</h2>
              <p className="mb-4">
                Our platform is not intended for users under the age of 18. We do not knowingly collect personal 
                information from children under 18. If you believe we have collected such information, please 
                contact us immediately.
              </p>
            </section>

            {/* Contact */}
            <section>
              <h2 className="text-2xl font-bold text-[#9B4819] mb-4">10. Contact Us</h2>
              <p className="mb-2">
                If you have any questions about this Privacy Policy or our data practices, please contact us at:
              </p>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p><strong>Email:</strong> gostorezcompany@gmail.com</p>
                <p><strong>Address:</strong> 02, Chukwuemeka Odumegwu Ojuwku University, Uli Anambra State, Nigeria</p>
                <p><strong>Response Time:</strong> We aim to respond to all privacy inquiries within 48 hours.</p>
              </div>
            </section>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <Link 
            to="/signup" 
            className="inline-flex items-center text-[#9B4819] hover:text-[#7a3914] font-medium"
          >
            ← Back to Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
import React from 'react';
import { Link } from 'react-router-dom';


const TermsOfService: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#F4F1E8] py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center mb-4">

            <span className="ml-2 text-xl font-bold text-[#9B4819]">Campus GOSTOREz</span>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Terms of Service</h1>
          <p className="mt-2 text-sm text-gray-600">Last updated: {new Date().toLocaleDateString()}</p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8">
          <div className="prose prose-lg max-w-none">
            {/* Introduction */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-[#9B4819] mb-4">1. Agreement to Terms</h2>
              <p className="mb-4">
                By accessing or using Campus GOSTOREz ("the Platform"), you agree to be bound by these Terms of Service 
                and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited 
                from using or accessing this platform.
              </p>
            </section>

            {/* Definitions */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-[#9B4819] mb-4">2. Definitions</h2>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li><strong>Platform:</strong> Campus GOSTOREz website, mobile application, and related services</li>
                <li><strong>User:</strong> Any individual or entity accessing the Platform</li>
                <li><strong>Vendor:</strong> Users who list products or services for sale</li>
                <li><strong>Buyer:</strong> Users who purchase products or services</li>
                <li><strong>Content:</strong> Any text, images, videos, or other materials posted on the Platform</li>
              </ul>
            </section>

            {/* User Accounts */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-[#9B4819] mb-4">3. User Accounts</h2>
              <div className="space-y-4">
                <p><strong>3.1 Eligibility:</strong> You must be at least 18 years old and have the legal capacity to enter into binding contracts.</p>
                <p><strong>3.2 Account Creation:</strong> You must provide accurate and complete information during registration.</p>
                <p><strong>3.3 Account Security:</strong> You are responsible for maintaining the confidentiality of your account credentials.</p>
                <p><strong>3.4 University Verification:</strong> Campus GOSTOREz reserves the right to verify university affiliation.</p>
              </div>
            </section>

            {/* Vendor Terms */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-[#9B4819] mb-4">4. Vendor Responsibilities</h2>
              <div className="space-y-4">
                <p><strong>4.1 Product Listings:</strong> Vendors must provide accurate descriptions, prices, and images of products.</p>
                <p><strong>4.2 Prohibited Items:</strong> The following items are strictly prohibited:</p>
                <ul className="list-disc pl-8">
                  <li>Illegal substances or paraphernalia</li>
                  <li>Weapons, firearms, or ammunition</li>
                  <li>Stolen property</li>
                  <li>Counterfeit or pirated goods</li>
                  <li>Hazardous materials</li>
                  <li>Adult content or services</li>
                </ul>
                <p><strong>4.3 Subscription Fees:</strong> Vendors agree to pay applicable subscription fees as outlined in the pricing section.</p>
              </div>
            </section>

            {/* Payments & Transactions */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-[#9B4819] mb-4">5. Payments and Transactions</h2>
              <div className="space-y-4">
                <p><strong>5.1 Payment Processing:</strong> All transactions are processed through secure third-party payment gateways.</p>
                <p><strong>5.2 Fees:</strong> Campus GOSTOREz may charge transaction fees as specified in the current fee schedule.</p>
                <p><strong>5.3 Refunds:</strong> Refund policies are determined by individual vendors and must be clearly stated.</p>
                <p><strong>5.4 Disputes:</strong> Transaction disputes should be reported within 14 days of purchase.</p>
              </div>
            </section>

            {/* Intellectual Property */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-[#9B4819] mb-4">6. Intellectual Property</h2>
              <p className="mb-4">
                The Platform and its original content, features, and functionality are owned by Campus GOSTOREz 
                and are protected by international copyright, trademark, and other intellectual property laws.
              </p>
            </section>

            {/* Termination */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-[#9B4819] mb-4">7. Termination</h2>
              <p className="mb-4">
                We may terminate or suspend your account immediately, without prior notice, for conduct that we 
                believe violates these Terms or is harmful to other users, us, or third parties, or for any other reason.
              </p>
            </section>

            {/* Limitation of Liability */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-[#9B4819] mb-4">8. Limitation of Liability</h2>
              <p className="mb-4">
                To the fullest extent permitted by applicable law, Campus GOSTOREz shall not be liable for any 
                indirect, incidental, special, consequential, or punitive damages resulting from your use of the Platform.
              </p>
            </section>

            {/* Contact */}
            <section>
              <h2 className="text-2xl font-bold text-[#9B4819] mb-4">9. Contact Information</h2>
              <p>
                For questions about these Terms of Service, please contact us at:
                <br />
                Email: gostorezcompany@gmail.com
                <br />
                Address: 02, Chukwuemeka Odumegwu Ojuwku University, Uli Anambra State, Nigeria
              </p>
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

export default TermsOfService;
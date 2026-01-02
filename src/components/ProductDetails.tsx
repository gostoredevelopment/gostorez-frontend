import React, { useState } from "react";
import { auth } from "../firebaseClient";

function ProductDetails({ product }: { product: any }) {
  const [loading, setLoading] = useState(false);

  const startChat = async () => {
    const user = auth.currentUser;
    if (!user) {
      alert("Please login to message the vendor");
      return;
    }

    setLoading(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch(
        `${process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000'}/api/chat/room/start`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            vendor_uid: product.user_id, // Make sure this field exists
            product_id: product.id,
            product_name: product.name,
            product_image: product.image_url,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to start chat");
      }

      const room = await response.json();
      // Redirect to chat room
      window.location.href = `/chat/${room.id}`;
    } catch (error) {
      console.error("Start chat error:", error);
      alert("Failed to start chat. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="product-details">
      {/* Your existing product details */}
      
      {/* Add Message Vendor button next to Add to Cart */}
      <div className="flex space-x-4 mt-4">
        <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
          Add to Cart
        </button>
        <button 
          onClick={startChat}
          disabled={loading}
          className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? "Starting..." : "💬 Message Vendor"}
        </button>
      </div>
    </div>
  );
}

export default ProductDetails;
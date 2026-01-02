// frontend/src/services/chatService.ts
import { auth } from '../lib/firebase';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

class ChatService {
  private async getHeaders() {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    const token = await user.getIdToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  // Get user conversations
  async getConversations() {
    const response = await fetch(`${API_BASE_URL}/api/chat/conversations`, {
      method: 'GET',
      headers: await this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch conversations: ${response.statusText}`);
    }

    return response.json();
  }

  // Create or get chat room
  async createRoom(vendorFirebaseUid: string, product?: { id?: string; name?: string; image?: string }) {
    const response = await fetch(`${API_BASE_URL}/api/chat/room`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify({
        vendor_firebase_uid: vendorFirebaseUid,
        product_id: product?.id,
        product_name: product?.name,
        product_image: product?.image,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create room: ${response.statusText}`);
    }

    return response.json();
  }

  // Get messages in a room
  async getMessages(roomId: string, limit = 50, offset = 0) {
    const response = await fetch(
      `${API_BASE_URL}/api/chat/room/${roomId}/messages?limit=${limit}&offset=${offset}`,
      {
        method: 'GET',
        headers: await this.getHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch messages: ${response.statusText}`);
    }

    return response.json();
  }

  // Send a message
  async sendMessage(roomId: string, message: string, type = 'text', media?: { url: string; type: string }) {
    const response = await fetch(`${API_BASE_URL}/api/chat/room/${roomId}/message`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify({
        message_text: message,
        message_type: type,
        media_url: media?.url,
        media_type: media?.type,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.statusText}`);
    }

    return response.json();
  }

  // Search vendors
  async searchVendors(query: string, limit = 20) {
    const response = await fetch(
      `${API_BASE_URL}/api/chat/search/vendors?query=${encodeURIComponent(query)}&limit=${limit}`,
      {
        method: 'GET',
        headers: await this.getHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to search vendors: ${response.statusText}`);
    }

    return response.json();
  }

  // Sync user to Supabase
  async syncUser(userData: { name?: string; email?: string; phone?: string; avatar_url?: string; user_type?: string }) {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    const response = await fetch(`${API_BASE_URL}/api/chat/sync-user`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      throw new Error(`Failed to sync user: ${response.statusText}`);
    }

    return response.json();
  }

  // Get user profile
  async getProfile() {
    const response = await fetch(`${API_BASE_URL}/api/chat/profile`, {
      method: 'GET',
      headers: await this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to get profile: ${response.statusText}`);
    }

    return response.json();
  }
}

export const chatService = new ChatService();
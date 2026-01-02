import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { auth } from '../lib/firebase';
import { supabase } from '../lib/supabaseClient';
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { 
  ArrowLeft, 
  Send, 
  Image as ImageIcon,
  Mic, 
  MoreVertical,
  Check,
  CheckCheck,
  User,
  Store,
  Phone,
  Video,
  Info,
  X,
  Clock,
  AlertCircle,
  Shield,
  Search,
  Paperclip,
  Smile,
  Volume2
} from "lucide-react";
import "./ChatRoom.css";

type Message = {
  id: string;
  room_id: string;
  sender_id: string;
  message_type: 'text' | 'image' | 'voice' | 'offer' | 'system';
  message_text: string;
  media_url?: string;
  media_type?: string;
  file_name?: string;
  file_size?: number;
  is_read: boolean;
  read_at?: string;
  delivered: boolean;
  delivered_at?: string;
  metadata?: Record<string, any>;
  created_at: string;
};

type Participant = {
  id: string;
  name: string;
  avatar_url?: string;
  user_type: 'user' | 'vendor';
  firebase_uid?: string;
  shop_id?: string;
  shop_name?: string;
  is_online?: boolean;
  last_seen?: string;
};

type RoomDetails = {
  id: string;
  p_a: string;
  p_b: string;
  p_a_name: string;
  p_b_name: string;
  p_a_image?: string;
  p_b_image?: string;
  chat_type: 'user_user' | 'user_vendor' | 'vendor_vendor';
  product_id?: string;
  product_name?: string;
  product_image?: string;
  last_message?: string;
  last_message_at?: string;
  unread_count: number;
  created_at: string;
  updated_at: string;
};

export default function ChatRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  
  const [user, setUser] = useState<any>(null);
  const [supabaseUserId, setSupabaseUserId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [roomDetails, setRoomDetails] = useState<RoomDetails | null>(null);
  const [otherParticipant, setOtherParticipant] = useState<Participant | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get Supabase user ID from Firebase UID
  const getSupabaseUserId = async (firebaseUid: string): Promise<string> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('firebase_uid', firebaseUid)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('User not found in Supabase');
      return data.id;
    } catch (error) {
      console.error('Error getting Supabase user ID:', error);
      throw error;
    }
  };

  // Fetch room details and identify other participant - FIXED the .single() error
  const fetchRoomDetails = useCallback(async (userId: string) => {
    if (!roomId) return;

    try {
      console.log("🟡 Fetching room details for room:", roomId);
      console.log("🟡 Current user ID:", userId);
      
      // Fetch room details with participant names - FIX: Changed .single() to .maybeSingle()
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .maybeSingle(); // Changed from .single() to .maybeSingle()

      if (roomError) {
        console.error("❌ Room query error:", roomError);
        throw roomError;
      }

      if (!roomData) {
        console.error("❌ Room not found with ID:", roomId);
        setError('Chat room not found');
        return;
      }

      console.log("🟡 Room data found:", roomData);
      setRoomDetails(roomData);

      // Identify which participant is the other one
      const isParticipantA = roomData.p_a === userId;
      const otherParticipantId = isParticipantA ? roomData.p_b : roomData.p_a;
      
      console.log("🟡 Current user is participant:", isParticipantA ? 'A' : 'B');
      console.log("🟡 Other participant ID:", otherParticipantId);

      // For now, create participant from room data directly
      // Since rooms table already stores p_a_name, p_a_image, p_b_name, p_b_image
      let participant: Participant = {
        id: otherParticipantId,
        name: isParticipantA ? roomData.p_b_name : roomData.p_a_name,
        avatar_url: isParticipantA ? roomData.p_b_image : roomData.p_a_image,
        user_type: 'user', // Default to user, we'll try to determine type below
        is_online: false,
        last_seen: new Date().toISOString()
      };

      // Try to get more details from users table (optional - not required for basic chat)
      try {
        const { data: otherUserData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', otherParticipantId)
          .maybeSingle();

        if (!userError && otherUserData) {
          console.log("🟡 Found user data for participant:", otherUserData);
          participant.user_type = otherUserData.user_type || 'user';
          participant.firebase_uid = otherUserData.firebase_uid;
          participant.is_online = otherUserData.is_active;
          participant.last_seen = otherUserData.last_seen;
        } else {
          console.log("🟡 No user data found, using room data only");
          // Try to determine if it's a vendor based on chat_type
          if (roomData.chat_type === 'user_vendor' || roomData.chat_type === 'vendor_vendor') {
            participant.user_type = 'vendor';
          }
        }
      } catch (userFetchError) {
        console.log("🟡 Could not fetch user details, using room data:", userFetchError);
        // Continue with basic participant info from room data
      }

      // If it's a vendor, try to get shop name from vendor_profiles
      if (participant.user_type === 'vendor' && participant.firebase_uid) {
        try {
          const { data: shopData } = await supabase
            .from('vendor_profiles')
            .select('shop_name, profile_image')
            .eq('user_id', participant.firebase_uid)
            .maybeSingle();

          if (shopData) {
            participant.shop_name = shopData.shop_name;
            participant.avatar_url = shopData.profile_image || participant.avatar_url;
          }
        } catch (shopError) {
          console.log("🟡 Could not fetch shop details:", shopError);
        }
      }

      console.log("🟡 Final participant data:", participant);
      setOtherParticipant(participant);

    } catch (error: any) {
      console.error('❌ Error fetching room details:', error);
      setError('Failed to load chat details: ' + (error.message || 'Unknown error'));
    }
  }, [roomId]);

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    if (!roomId) return;

    setLoading(true);
    try {
      console.log("🟡 Fetching messages for room:", roomId);
      
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error("❌ Messages query error:", error);
        throw error;
      }

      console.log("🟡 Messages fetched:", data?.length || 0);
      setMessages(data || []);
      
      // Mark messages as read
      await markMessagesAsRead();
      
    } catch (error: any) {
      console.error('❌ Error fetching messages:', error);
      setError('Failed to load messages: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  // Mark messages as read
  const markMessagesAsRead = async () => {
    if (!roomId || !supabaseUserId) return;

    try {
      // Get unread messages from other participant
      const { data: unreadMessages } = await supabase
        .from('messages')
        .select('id')
        .eq('room_id', roomId)
        .neq('sender_id', supabaseUserId)
        .eq('is_read', false)
        .maybeSingle();

      if (unreadMessages) {
        const now = new Date().toISOString();
        
        await supabase
          .from('messages')
          .update({ 
            is_read: true,
            read_at: now,
            delivered: true,
            delivered_at: now
          })
          .eq('id', unreadMessages.id);

        // Update room unread count
        await supabase
          .from('rooms')
          .update({ unread_count: 0 })
          .eq('id', roomId);
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  // Send message
  const sendMessage = async (type: 'text' | 'image' | 'voice' = 'text', content?: any, fileName?: string) => {
    if (!roomId || !supabaseUserId || (!newMessage.trim() && type === 'text' && !content)) return;

    setSending(true);
    try {
      const messageData: any = {
        room_id: roomId,
        sender_id: supabaseUserId,
        message_type: type,
        message_text: type === 'text' ? newMessage : (type === 'image' ? '📷 Image' : '🎤 Voice message'),
        is_read: false,
        delivered: false,
        created_at: new Date().toISOString()
      };

      if (type === 'image' && content) {
        messageData.media_url = content;
        messageData.media_type = 'image';
        if (fileName) {
          messageData.file_name = fileName;
        }
      } else if (type === 'voice' && content) {
        messageData.media_url = content;
        messageData.media_type = 'audio';
        messageData.file_name = fileName || `voice_${Date.now()}.webm`;
      }

      const { data, error } = await supabase
        .from('messages')
        .insert([messageData])
        .select()
        .single();

      if (error) throw error;

      // Update room last message
      await supabase
        .from('rooms')
        .update({
          last_message: messageData.message_text,
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', roomId);

      // Add message to state
      setMessages(prev => [...prev, data]);
      if (type === 'text') {
        setNewMessage("");
      }

      // Scroll to bottom
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);

    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  // Handle text message send
  const handleSendMessage = () => {
    if (newMessage.trim()) {
      sendMessage('text');
    }
  };

  // Handle key press for sending
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // For now, we'll send as base64
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      sendMessage('image', base64, file.name);
    } catch (error) {
      console.error('Error uploading image:', error);
    }
  };

  // Start voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const audioChunks: BlobPart[] = [];

      recorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        
        // Convert to base64
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(audioBlob);
        });

        // Send voice message
        sendMessage('voice', base64, `voice_${Date.now()}.webm`);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingTime(0);
      
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  // Stop voice recording
  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      setRecordingTime(0);
    }
  };

  // Format time for display
  const formatTime = (timestamp: string) => {
    const date = parseISO(timestamp);
    return format(date, 'h:mm a');
  };

  // Format date for grouping
  const formatDate = (timestamp: string) => {
    const date = parseISO(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return format(date, 'MMMM d, yyyy');
    }
  };

  // Group messages by date
  const groupMessagesByDate = () => {
    const groups: { [key: string]: Message[] } = {};
    
    messages.forEach(message => {
      const date = formatDate(message.created_at);
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(message);
    });

    return groups;
  };

  // Handle user authentication
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const supabaseId = await getSupabaseUserId(currentUser.uid);
          setSupabaseUserId(supabaseId);
        } catch (error) {
          console.error('Auth error:', error);
          navigate('/login');
        }
      } else {
        navigate('/login');
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  // Fetch data when roomId or supabaseUserId changes
  useEffect(() => {
    if (roomId && supabaseUserId) {
      fetchRoomDetails(supabaseUserId);
      fetchMessages();
      
      // Set up real-time subscription for new messages
      const channel = supabase
        .channel(`room:${roomId}`)
        .on('postgres_changes', 
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'messages',
            filter: `room_id=eq.${roomId}`
          }, 
          (payload) => {
            const newMessage = payload.new as Message;
            setMessages(prev => [...prev, newMessage]);
            
            // Mark as read if it's from other participant
            if (newMessage.sender_id !== supabaseUserId) {
              markMessagesAsRead();
            }
            
            setTimeout(() => {
              messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 100);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [roomId, supabaseUserId]);

  // Auto-scroll when messages change
  useEffect(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, [messages]);

  // Handle typing indicator
  useEffect(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (newMessage) {
      setIsTyping(true);
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
      }, 1000);
    } else {
      setIsTyping(false);
    }

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [newMessage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
      }
    };
  }, [mediaRecorder, isRecording]);

  if (loading && messages.length === 0) {
    return (
      <div className="chatroom-loading">
        <div className="chatroom-spinner"></div>
        <p>Loading chat...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="chatroom-error">
        <AlertCircle size={24} />
        <p>{error}</p>
        <button 
          className="chatroom-retry"
          onClick={() => {
            setError(null);
            if (supabaseUserId) {
              fetchRoomDetails(supabaseUserId);
              fetchMessages();
            }
          }}
        >
          Retry
        </button>
        <button 
          className="chatroom-back-btn"
          onClick={() => navigate('/chats')}
        >
          Back to Chats
        </button>
      </div>
    );
  }

  const messageGroups = groupMessagesByDate();

  return (
    <div className="chatroom-container">
      {/* Header - Fixed 40px height */}
      <div className="chatroom-header">
        <div className="chatroom-header-left">
          <button 
            className="chatroom-back"
            onClick={() => navigate('/chats')}
          >
            <ArrowLeft size={16} />
          </button>
          
          <div className="chatroom-userinfo">
            <div className="chatroom-userpic">
              {otherParticipant?.avatar_url ? (
                <img 
                  src={otherParticipant.avatar_url} 
                  alt={otherParticipant.name}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : null}
              {(!otherParticipant?.avatar_url) && (
                <div className="chatroom-userpic-placeholder">
                  {otherParticipant?.user_type === 'vendor' ? <Store size={12} /> : <User size={12} />}
                </div>
              )}
              {otherParticipant?.is_online && (
                <div className="chatroom-online"></div>
              )}
            </div>
            
            <div className="chatroom-userdetails">
              <h2 className="chatroom-username">
                {otherParticipant?.shop_name || otherParticipant?.name || 'Unknown'}
              </h2>
              <p className="chatroom-userstatus">
                {isTyping ? (
                  <span className="chatroom-typing">typing...</span>
                ) : otherParticipant?.is_online ? (
                  <span className="chatroom-online-text">online</span>
                ) : otherParticipant?.last_seen ? (
                  `last seen ${formatDistanceToNow(parseISO(otherParticipant.last_seen))} ago`
                ) : (
                  'offline'
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="chatroom-header-right">
          <button className="chatroom-header-btn" title="Call">
            <Phone size={14} />
          </button>
          
          <button className="chatroom-header-btn" title="Video">
            <Video size={14} />
          </button>
          
          <button 
            className="chatroom-header-btn" 
            title="Info"
            onClick={() => setShowInfoPanel(!showInfoPanel)}
          >
            <Info size={14} />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="chatroom-messages" ref={messagesContainerRef}>
        {Object.entries(messageGroups).map(([date, dateMessages]) => (
          <div key={date} className="chatroom-date-group">
            <div className="chatroom-date">
              <span>{date}</span>
            </div>
            
            {dateMessages.map((message) => {
              const isOwnMessage = message.sender_id === supabaseUserId;
              
              return (
                <div 
                  key={message.id} 
                  className={`chatroom-message ${isOwnMessage ? 'own' : 'other'}`}
                >
                  {!isOwnMessage && otherParticipant?.avatar_url && (
                    <div className="chatroom-message-avatar">
                      <img 
                        src={otherParticipant.avatar_url} 
                        alt={otherParticipant.name}
                      />
                    </div>
                  )}
                  
                  <div className={`chatroom-bubble ${isOwnMessage ? 'own' : 'other'}`}>
                    {message.message_type === 'image' && message.media_url && (
                      <div className="chatroom-image">
                        <img 
                          src={message.media_url} 
                          alt="Shared image"
                          onClick={() => window.open(message.media_url, '_blank')}
                        />
                      </div>
                    )}
                    
                    {message.message_type === 'voice' && message.media_url && (
                      <div className="chatroom-voice">
                        <button 
                          className="chatroom-voice-play"
                          onClick={() => {
                            const audio = new Audio(message.media_url);
                            audio.play();
                          }}
                        >
                          <Volume2 size={12} />
                        </button>
                        <div className="chatroom-voice-wave">
                          <div className="chatroom-voice-bar"></div>
                          <div className="chatroom-voice-bar"></div>
                          <div className="chatroom-voice-bar"></div>
                          <div className="chatroom-voice-bar"></div>
                          <div className="chatroom-voice-bar"></div>
                        </div>
                        <span className="chatroom-voice-time">0:{Math.floor(Math.random() * 30) + 10}</span>
                      </div>
                    )}
                    
                    {message.message_text && (
                      <p className="chatroom-text">{message.message_text}</p>
                    )}
                    
                    <div className="chatroom-meta">
                      <span className="chatroom-time">
                        {formatTime(message.created_at)}
                      </span>
                      
                      {isOwnMessage && (
                        <div className="chatroom-status">
                          {message.is_read ? (
                            <CheckCheck size={10} className="chatroom-read" />
                          ) : message.delivered ? (
                            <CheckCheck size={10} className="chatroom-delivered" />
                          ) : (
                            <Check size={10} className="chatroom-sent" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area - Fixed 40px height */}
      <div className="chatroom-input">
        <div className="chatroom-input-left">
          <button 
            className="chatroom-input-btn"
            onClick={() => document.getElementById('chatroom-image-upload')?.click()}
            title="Image"
          >
            <ImageIcon size={14} />
          </button>
          
          <input
            type="file"
            id="chatroom-image-upload"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleImageUpload}
          />
          
          <button 
            className={`chatroom-input-btn ${isRecording ? 'recording' : ''}`}
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            title="Hold to record"
          >
            <Mic size={14} />
          </button>
          
          {isRecording && (
            <div className="chatroom-recording">
              <div className="chatroom-recording-dot"></div>
              <span className="chatroom-recording-time">{recordingTime}s</span>
              <span className="chatroom-recording-text">Release to send</span>
            </div>
          )}
        </div>
        
        <div className="chatroom-input-center">
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="chatroom-input-field"
            disabled={sending}
          />
        </div>
        
        <div className="chatroom-input-right">
          {newMessage ? (
            <button 
              className="chatroom-send"
              onClick={handleSendMessage}
              disabled={sending}
            >
              {sending ? (
                <div className="chatroom-send-spinner"></div>
              ) : (
                <Send size={12} />
              )}
            </button>
          ) : (
            <button className="chatroom-input-btn" title="Attach">
              <Paperclip size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Info Panel */}
      {showInfoPanel && roomDetails && (
        <div className="chatroom-info">
          <div className="chatroom-info-header">
            <h3>Chat Info</h3>
            <button 
              className="chatroom-info-close"
              onClick={() => setShowInfoPanel(false)}
            >
              <X size={12} />
            </button>
          </div>
          
          <div className="chatroom-info-content">
            <div className="chatroom-info-section">
              <h4>Participant</h4>
              <div className="chatroom-info-user">
                <div className="chatroom-info-pic">
                  {otherParticipant?.avatar_url ? (
                    <img src={otherParticipant.avatar_url} alt={otherParticipant.name} />
                  ) : (
                    <div className="chatroom-info-pic-placeholder">
                      {otherParticipant?.user_type === 'vendor' ? <Store size={10} /> : <User size={10} />}
                    </div>
                  )}
                </div>
                <div className="chatroom-info-details">
                  <span className="chatroom-info-name">
                    {otherParticipant?.shop_name || otherParticipant?.name}
                  </span>
                  <span className="chatroom-info-type">
                    {otherParticipant?.user_type === 'vendor' ? 'Shop' : 'User'}
                  </span>
                </div>
              </div>
            </div>
            
            {roomDetails.product_name && (
              <div className="chatroom-info-section">
                <h4>Product</h4>
                <div className="chatroom-info-product">
                  {roomDetails.product_image && (
                    <img 
                      src={roomDetails.product_image} 
                      alt={roomDetails.product_name}
                      className="chatroom-info-product-img"
                    />
                  )}
                  <span className="chatroom-info-product-name">
                    {roomDetails.product_name}
                  </span>
                </div>
              </div>
            )}
            
            <div className="chatroom-info-section">
              <h4>Details</h4>
              <div className="chatroom-info-stats">
                <div className="chatroom-info-stat">
                  <span>Chat Type:</span>
                  <span>{roomDetails.chat_type}</span>
                </div>
                <div className="chatroom-info-stat">
                  <span>Created:</span>
                  <span>{format(parseISO(roomDetails.created_at), 'MMM d, yyyy')}</span>
                </div>
                <div className="chatroom-info-stat">
                  <span>Messages:</span>
                  <span>{messages.length}</span>
                </div>
              </div>
            </div>
            
            <div className="chatroom-info-actions">
              <button className="chatroom-info-btn">
                <Shield size={12} />
                <span>Block</span>
              </button>
              <button className="chatroom-info-btn chatroom-info-btn-danger">
                <AlertCircle size={12} />
                <span>Report</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
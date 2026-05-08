import React, { useEffect, useState, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from '../lib/firebase';
import { doc, getDoc } from "firebase/firestore";
import { supabase } from '../lib/supabaseClient';
import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { PhoneCall, History } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  Search, 
  MessageCircle, 
  Home, 
  Store, 
  ShoppingBag, 
  Heart, 
  Filter,
  Check,
  User as UserIcon,
  Building,
  X,
  ChevronDown,
  Settings
} from "lucide-react";
import "./ChatList.css";

type RoomItem = {
  room_id: string;
  other_participant_id: string;
  other_participant_name: string;
  other_participant_avatar: string;
  other_participant_type: 'user' | 'vendor';
  chat_type: 'user_user' | 'user_vendor' | 'vendor_vendor';
  last_message?: string;
  last_message_at?: string;
  unread_count?: number;
  updated_at?: string;
  is_read?: boolean;
};

type ChatPersona = {
  id: string;
  name: string;
  avatar: string;
  type: 'user' | 'vendor';
  shop_id?: string;
  firebase_uid?: string;
};

type FirebaseUserProfile = {
  name?: string;
  email?: string;
  phone?: string;
  profileImage?: string;
  role?: string;
  isVerified?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export default function ChatList() {
  const [user, setUser] = useState<any>(null);
  const [firebaseUserProfile, setFirebaseUserProfile] = useState<FirebaseUserProfile | null>(null);
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [searchId, setSearchId] = useState("");
  const [searchResults, setSearchResults] = useState<any>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activePersona, setActivePersona] = useState<ChatPersona | null>(null);
  const [personas, setPersonas] = useState<ChatPersona[]>([]);
  const [showPersonaMenu, setShowPersonaMenu] = useState(false);
  const [sortBy, setSortBy] = useState<'recent' | 'unread'>('recent');
  const [showSettings, setShowSettings] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [currentPersonaId, setCurrentPersonaId] = useState<string | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const personaMenuRef = useRef<HTMLDivElement>(null);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const autoSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const navigate = useNavigate();

  console.log("🔵 ChatList Component Mounted");
  console.log("🔵 Current State:", {
    user: user?.uid || "null",
    loading,
    roomsCount: rooms.length,
    activePersona,
    personasCount: personas.length,
    firebaseProfile: !!firebaseUserProfile,
    initialLoadComplete
  });

  // Fetch user profile from Firebase Firestore
  const fetchFirebaseUserProfile = async (firebaseUid: string) => {
    try {
      console.log("🟡 Fetching Firebase profile for:", firebaseUid);
      const userDoc = await getDoc(doc(db, 'users', firebaseUid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        console.log("🟡 Firebase user data found:", userData);
        
        const profile: FirebaseUserProfile = {
          name: userData.name || '',
          email: userData.email || '',
          phone: userData.phone || '',
          profileImage: userData.profileImage || '',
          role: userData.role || 'user',
          isVerified: userData.isVerified || false,
          createdAt: userData.createdAt?.toDate().toISOString() || '',
          updatedAt: userData.updatedAt?.toDate().toISOString() || ''
        };
        
        setFirebaseUserProfile(profile);
        return profile;
      } else {
        console.log("🟡 No Firebase user document found");
        // Create basic profile from auth data
        const firebaseUser = auth.currentUser;
        const profile: FirebaseUserProfile = {
          name: firebaseUser?.displayName || '',
          email: firebaseUser?.email || '',
          phone: firebaseUser?.phoneNumber || '',
          profileImage: firebaseUser?.photoURL || '',
          role: 'user',
          isVerified: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        setFirebaseUserProfile(profile);
        return profile;
      }
    } catch (error) {
      console.error('❌ Error fetching Firebase user profile:', error);
      const firebaseUser = auth.currentUser;
      const profile: FirebaseUserProfile = {
        name: firebaseUser?.displayName || '',
        email: firebaseUser?.email || '',
        phone: firebaseUser?.phoneNumber || '',
        profileImage: firebaseUser?.photoURL || '',
        role: 'user',
        isVerified: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      setFirebaseUserProfile(profile);
      return profile;
    }
  };

  // Sync user data from Firebase to Supabase
  const syncUserToSupabase = async (firebaseUid: string, firebaseProfile: FirebaseUserProfile) => {
    try {
      console.log("🟡 Syncing user to Supabase:", firebaseUid);
      
      // Check if user already exists in Supabase
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('id, firebase_uid, rooms, room_count')
        .eq('firebase_uid', firebaseUid)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking user in Supabase:', checkError);
      }

      const userData = {
        firebase_uid: firebaseUid,
        name: firebaseProfile.name || '',
        email: firebaseProfile.email || '',
        phone: firebaseProfile.phone || '',
        avatar_url: firebaseProfile.profileImage || '',
        user_type: 'user',
        rooms: existingUser?.rooms || [],
        room_count: existingUser?.room_count || 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_seen: new Date().toISOString(),
        is_active: true
      };

      if (!existingUser) {
        console.log("🟡 Inserting new user to Supabase");
        const { data: newUser, error: insertError } = await supabase
          .from('users')
          .insert([userData])
          .select()
          .single();

        if (insertError) {
          console.error('❌ Error inserting user to Supabase:', insertError);
        } else {
          console.log('✅ User synced to Supabase:', newUser.id);
        }
      } else {
        console.log("🟡 Updating existing user in Supabase");
        // Update user, including avatar_url
        const { error: updateError } = await supabase
          .from('users')
          .update({ 
            name: userData.name,
            email: userData.email,
            phone: userData.phone,
            avatar_url: userData.avatar_url,
            rooms: userData.rooms,
            room_count: userData.room_count,
            last_seen: userData.last_seen,
            updated_at: userData.updated_at
          })
          .eq('id', existingUser.id);

        if (updateError) {
          console.error('❌ Error updating user in Supabase:', updateError);
        } else {
          console.log('✅ User updated in Supabase');
        }
      }
    } catch (error) {
      console.error('❌ Error in syncUserToSupabase:', error);
    }
  };

  // Firebase auth listener
  useEffect(() => {
    console.log("🟡 useEffect for auth listener triggered");
    
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log("🟡 onAuthStateChanged fired:", {
        hasUser: !!currentUser,
        uid: currentUser?.uid || "none"
      });
      
      if (currentUser) {
        setUser(currentUser);
        
        // 1. Fetch profile from Firebase Firestore
        const firebaseProfile = await fetchFirebaseUserProfile(currentUser.uid);
        
        // 2. Sync to Supabase (with avatar)
        await syncUserToSupabase(currentUser.uid, firebaseProfile);
        
        // 3. Load personas
        await loadPersonas(currentUser.uid, firebaseProfile);
      } else {
        console.log("🟡 No user, clearing state");
        setUser(null);
        setRooms([]);
        setLoading(false);
        setInitialLoadComplete(true);
      }
    });
    
    return () => {
      console.log("🟡 Cleaning up auth listener");
      unsubscribe();
    };
  }, []);

  // Load user personas from Supabase (including personal profile)
  const loadPersonas = async (userId: string, firebaseProfile: FirebaseUserProfile) => {
    console.log("🟡 loadPersonas called with userId:", userId);
    console.log("🟡 Firebase profile:", firebaseProfile);
    
    try {
      // First, get the user's Supabase ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, avatar_url, rooms, room_count')
        .eq('firebase_uid', userId)
        .maybeSingle();

      if (userError) {
        console.error("❌ Error fetching user data:", userError);
        throw userError;
      }

      if (!userData) {
        console.error("❌ User not found in Supabase users table");
        throw new Error("User not found in database");
      }

      // Personal persona from Supabase user data
      const personalPersona: ChatPersona = {
        id: userData.id, // Use Supabase ID, not Firebase UID
        name: userData.name || firebaseProfile.name || 'Personal',
        avatar: userData.avatar_url || firebaseProfile.profileImage || '',
        type: 'user',
        firebase_uid: userId
      };

      console.log("🟡 Personal persona created:", personalPersona);

      // Get user's shops from vendor_profiles table
      console.log("🟡 Fetching shops from vendor_profiles...");
      const { data: shopsData, error: shopsError } = await supabase
        .from('vendor_profiles')
        .select('id, shop_name, profile_image, user_id, rooms, room_count')
        .eq('user_id', userId);

      console.log("🟡 Shops query result:", {
        data: shopsData,
        error: shopsError?.message,
        count: shopsData?.length || 0
      });

      const vendorPersonas: ChatPersona[] = [];
      if (!shopsError && shopsData) {
        shopsData.forEach((shop: any, index: number) => {
          console.log(`🟡 Shop ${index + 1}:`, shop);
          vendorPersonas.push({
            id: shop.id,
            name: shop.shop_name || 'Shop',
            avatar: shop.profile_image || '',
            type: 'vendor',
            shop_id: shop.id,
            firebase_uid: shop.user_id
          });
        });
      }

      const allPersonas = [personalPersona, ...vendorPersonas];
      console.log("🟡 All personas:", allPersonas);
      
      setPersonas(allPersonas);
      setActivePersona(allPersonas[0]);
      setCurrentPersonaId(allPersonas[0].id);
      
      // Fetch rooms for the initial persona
      await fetchRoomsForPersona(allPersonas[0]);
      setInitialLoadComplete(true);
      
    } catch (error) {
      console.error('❌ Error loading personas:', error);
      const firebaseUser = auth.currentUser;
      const personalPersona: ChatPersona = {
        id: userId, // Use Firebase UID as fallback
        name: firebaseUser?.displayName || 'Personal',
        avatar: firebaseUser?.photoURL || '',
        type: 'user',
        firebase_uid: userId
      };
      console.log("🟡 Fallback to personal persona only");
      setPersonas([personalPersona]);
      setActivePersona(personalPersona);
      setCurrentPersonaId(personalPersona.id);
      
      // Fetch rooms for fallback persona
      await fetchRoomsForPersona(personalPersona);
      setInitialLoadComplete(true);
    }
  };

  // Fetch chat rooms for a specific persona - FIXED VERSION
  const fetchRoomsForPersona = async (persona: ChatPersona) => {
    console.log("🟡 fetchRoomsForPersona called for:", {
      id: persona.id,
      name: persona.name,
      type: persona.type
    });
    
    if (!persona) {
      console.log("❌ fetchRoomsForPersona: No persona, returning early");
      return;
    }
    
    setLoading(true);
    setError(null);
    setCurrentPersonaId(persona.id); // Track which persona we're loading for

    try {
      // Clear rooms immediately to prevent showing wrong persona's rooms
      setRooms([]);

      // Determine which table to query based on persona type
      let personaTable: 'users' | 'vendor_profiles';
      let queryField: string;
      let selectFields: string;
      
      if (persona.type === 'user') {
        personaTable = 'users';
        queryField = 'firebase_uid';
        selectFields = 'id, name, avatar_url, rooms, room_count';
      } else {
        personaTable = 'vendor_profiles';
        queryField = 'id';
        selectFields = 'id, shop_name, profile_image, rooms, room_count';
      }

      console.log(`🟡 Querying ${personaTable} with ${queryField} = ${persona.type === 'user' ? persona.firebase_uid : persona.id}`);
      
      // Get the persona's rooms array
      const { data: personaData, error: personaError } = await supabase
        .from(personaTable)
        .select(selectFields)
        .eq(queryField, persona.type === 'user' ? persona.firebase_uid : persona.id)
        .maybeSingle();

      if (personaError) {
        console.error("❌ Error fetching persona data:", personaError);
        throw personaError;
      }

      if (!personaData) {
        console.log("❌ No persona data found");
        setRooms([]);
        setLoading(false);
        return;
      }

      // Type assertion to handle the dynamic fields
      const personaDataTyped = personaData as any;
      
      // Extract the correct name field based on table
      const personaName = persona.type === 'user' 
        ? personaDataTyped.name 
        : personaDataTyped.shop_name;

      const roomIds = personaDataTyped.rooms || [];
      console.log(`🟡 ${personaTable} ID ${personaDataTyped.id} has ${roomIds.length} rooms:`, roomIds);
      
      if (roomIds.length === 0) {
        console.log("🟡 No rooms found for this persona");
        setRooms([]);
        setLoading(false);
        return;
      }

      // Fetch all room details in a single query using the room IDs array
      const { data: roomsData, error: roomsError } = await supabase
        .from('rooms')
        .select('*')
        .in('id', roomIds)
        .order('updated_at', { ascending: false });

      if (roomsError) {
        console.error("❌ Rooms query error:", roomsError);
        throw roomsError;
      }

      console.log("🟡 QUERY RESULT: Found", roomsData?.length || 0, "rooms for this persona");
      
      // Filter out any rooms that might not be in the persona's array (safety check)
      const validRoomsData = roomsData?.filter(room => roomIds.includes(room.id)) || [];
      console.log("🟡 After filtering:", validRoomsData.length, "valid rooms");

      // Transform rooms to show the OTHER participant
      const transformedRooms: RoomItem[] = validRoomsData.map((room: any) => {
        const isPersonaA = room.p_a === personaDataTyped.id;
        
        const otherParticipantId = isPersonaA ? room.p_b : room.p_a;
        const otherParticipantName = isPersonaA ? room.p_b_name : room.p_a_name;
        const otherParticipantAvatar = isPersonaA ? room.p_b_image : room.p_a_image;

        let otherParticipantType: 'user' | 'vendor' = 'user';
        if (room.chat_type === 'user_user') {
          otherParticipantType = 'user';
        } else if (room.chat_type === 'vendor_vendor') {
          otherParticipantType = 'vendor';
        } else if (room.chat_type === 'user_vendor') {
          // Determine based on participant positions and chat type
          if (isPersonaA) {
            // If persona is p_a, p_b is the other participant
            otherParticipantType = (persona.type === 'user') ? 'vendor' : 'user';
          } else {
            // If persona is p_b, p_a is the other participant
            otherParticipantType = (persona.type === 'user') ? 'vendor' : 'user';
          }
        }

        return {
          room_id: room.id,
          other_participant_id: otherParticipantId,
          other_participant_name: otherParticipantName || 'Unknown',
          other_participant_avatar: otherParticipantAvatar || '',
          other_participant_type: otherParticipantType,
          chat_type: room.chat_type || 'user_vendor',
          last_message: room.last_message,
          last_message_at: room.last_message_at,
          unread_count: room.unread_count,
          updated_at: room.updated_at,
          is_read: room.is_read
        };
      });

      // Sort rooms
      const sortedRooms = transformedRooms.sort((a, b) => {
        if (sortBy === 'unread') {
          const aUnread = a.unread_count || 0;
          const bUnread = b.unread_count || 0;
          if (bUnread !== aUnread) return bUnread - aUnread;
        }
        const aTime = new Date(a.updated_at || a.last_message_at || 0).getTime();
        const bTime = new Date(b.updated_at || b.last_message_at || 0).getTime();
        return bTime - aTime;
      });

      console.log("🟡 Setting rooms for persona:", {
        personaId: persona.id,
        personaName: persona.name,
        roomCount: sortedRooms.length
      });
      setRooms(sortedRooms);
      
    } catch (err: any) {
      console.error('❌ fetchRoomsForPersona error:', err);
      setError('Failed to load chatrooms: Please try again later');
      setRooms([]); // Clear rooms on error
    } finally {
      console.log("🟡 Setting loading to false");
      setLoading(false);
    }
  };

  // Auto-search when ID is entered (debounced)
  useEffect(() => {
    if (autoSearchTimeoutRef.current) {
      clearTimeout(autoSearchTimeoutRef.current);
    }

    if (searchId.trim().length >= 36) { // UUID is 36 characters
      autoSearchTimeoutRef.current = setTimeout(() => {
        console.log("🟡 Auto-searching for ID:", searchId);
        searchById();
      }, 500); // 500ms debounce
    }

    return () => {
      if (autoSearchTimeoutRef.current) {
        clearTimeout(autoSearchTimeoutRef.current);
      }
    };
  }, [searchId]);


  /////////////////////////////
// Mark chat notifications as read when chat list loads
useEffect(() => {
  const markChatNotificationsAsRead = async () => {
    if (!user || !initialLoadComplete) return;
    
    try {
      console.log("🟡 Marking chat notifications as read for user:", user.uid);
      
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('receiver_id', user.uid)
        .eq('notification_type', 'chat');
      
      if (error) {
        console.error('❌ Error marking chat notifications as read:', error);
      } else {
        console.log('✅ Chat notifications marked as read successfully');
      }
    } catch (error) {
      console.error('❌ Exception marking notifications as read:', error);
    }
  };
  
  markChatNotificationsAsRead();
}, [user, initialLoadComplete]);
///////////////////////////////////////

  // Search user/vendor by ID in Supabase
  const searchById = async () => {
    if (!searchId.trim() || !user) {
      console.log("❌ searchById: Missing searchId or user");
      return;
    }
    
    console.log("🟡 Manual search triggered for ID:", searchId);
    setSearchLoading(true);
    setSearchResults(null);

    try {
      // Try to find user by UUID in users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, avatar_url, firebase_uid, rooms, room_count')
        .eq('id', searchId)
        .maybeSingle();

      if (userError && userError.code !== 'PGRST116') {
        console.error('User search error:', userError);
      }

      if (userData) {
        console.log("✅ User found:", userData);
        setSearchResults({
          ...userData,
          type: 'user'
        });
        return;
      }

      // Try to find vendor in vendor_profiles table
      const { data: vendorData, error: vendorError } = await supabase
        .from('vendor_profiles')
        .select('id, shop_name, profile_image, user_id, rooms, room_count')
        .eq('id', searchId)
        .maybeSingle();

      if (vendorError && vendorError.code !== 'PGRST116') {
        console.error('Vendor search error:', vendorError);
      }

      if (vendorData) {
        console.log("✅ Vendor found:", vendorData);
        setSearchResults({
          id: vendorData.id,
          name: vendorData.shop_name,
          avatar_url: vendorData.profile_image,
          type: 'vendor',
          user_id: vendorData.user_id,
          rooms: vendorData.rooms,
          room_count: vendorData.room_count
        });
        return;
      }

      console.log("❌ No results found for ID:", searchId);
      setSearchResults(null);
    } catch (error) {
      console.error('❌ Search error:', error);
      setSearchResults(null);
    } finally {
      setSearchLoading(false);
    }
  };

  // Helper function to add room ID to a participant's rooms array with retry
  const addRoomToParticipant = async (
    table: 'users' | 'vendor_profiles',
    participantId: string,
    roomId: string,
    maxRetries = 3
  ): Promise<boolean> => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🟡 Attempt ${attempt}: Adding room ${roomId} to ${table} (ID: ${participantId})`);
        
        // Get current participant data
        const { data: participantData, error: fetchError } = await supabase
          .from(table)
          .select('rooms, room_count')
          .eq('id', participantId)
          .single();

        if (fetchError) {
          console.error(`❌ Error fetching ${table} data:`, fetchError);
          throw fetchError;
        }

        const currentRooms = participantData?.rooms || [];
        
        // Check if room already exists in array (avoid duplicates)
        if (currentRooms.includes(roomId)) {
          console.log(`✅ Room ${roomId} already exists in ${table} array`);
          return true;
        }

        // Add room to array and increment count
        const newRooms = [...currentRooms, roomId];
        const newCount = (participantData?.room_count || 0) + 1;

        const { error: updateError } = await supabase
          .from(table)
          .update({
            rooms: newRooms,
            room_count: newCount,
            updated_at: new Date().toISOString()
          })
          .eq('id', participantId);

        if (updateError) {
          console.error(`❌ Error updating ${table}:`, updateError);
          throw updateError;
        }

        console.log(`✅ Successfully added room to ${table}`);
        
        // Verify the update was successful
        await new Promise(resolve => setTimeout(resolve, 300)); // Wait 300ms for DB
        
        const { data: verifyData } = await supabase
          .from(table)
          .select('rooms')
          .eq('id', participantId)
          .single();

        if (verifyData?.rooms?.includes(roomId)) {
          console.log(`✅ Verified: Room ${roomId} is now in ${table} array`);
          return true;
        } else {
          console.warn(`⚠️ Room not found in ${table} after update, will retry`);
        }
      } catch (error) {
        console.error(`❌ Attempt ${attempt} failed:`, error);
        if (attempt === maxRetries) {
          console.error(`❌ Failed to add room to ${table} after ${maxRetries} attempts`);
          return false;
        }
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, attempt * 500));
      }
    }
    return false;
  };

  // Create new chat room - UPDATED with proper room tracking
  const createChatRoom = async (
    targetId: string, 
    targetName: string, 
    targetImage: string, 
    targetType: 'user' | 'vendor'
  ): Promise<{ success: boolean; roomId?: string; error?: string }> => {
    console.log("🟡 Starting createChatRoom function");
    setCreatingRoom(true);
    
    try {
      if (!activePersona || !user) {
        const errorMsg = "Please select a persona first";
        console.log("❌", errorMsg);
        return { success: false, error: errorMsg };
      }

      console.log("🟡 Creating chat room with:", {
        activePersona: {
          name: activePersona.name,
          type: activePersona.type,
          id: activePersona.id,
          firebase_uid: activePersona.firebase_uid
        },
        target: {
          id: targetId,
          name: targetName,
          type: targetType
        }
      });

      // Determine p_a (active persona's Supabase ID)
      let p_a_id: string;
      let p_a_name: string;
      let p_a_image: string;
      let p_a_type: 'user' | 'vendor';
      let p_a_table: 'users' | 'vendor_profiles';

      if (activePersona.type === 'user') {
        // Get user ID from users table
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, name, avatar_url, rooms, room_count')
          .eq('firebase_uid', activePersona.firebase_uid || '')
          .maybeSingle();

        if (userError) {
          console.error("❌ Error fetching user data:", userError);
          throw new Error(`Failed to fetch user data: ${userError.message}`);
        }

        if (!userData) {
          console.error("❌ User not found in users table");
          throw new Error("Your user account was not found in the database");
        }

        p_a_id = userData.id;
        p_a_name = userData.name || activePersona.name;
        p_a_image = userData.avatar_url || activePersona.avatar;
        p_a_type = 'user';
        p_a_table = 'users';
      } else {
        // Get vendor data from vendor_profiles table
        const { data: vendorData, error: vendorError } = await supabase
          .from('vendor_profiles')
          .select('id, shop_name, profile_image, rooms, room_count')
          .eq('id', activePersona.id)
          .maybeSingle();

        if (vendorError) {
          console.error("❌ Error fetching vendor data:", vendorError);
          throw new Error(`Failed to fetch vendor data: ${vendorError.message}`);
        }

        if (!vendorData) {
          console.error("❌ Vendor not found in vendor_profiles table");
          throw new Error("Your shop was not found in the database");
        }

        p_a_id = vendorData.id;
        p_a_name = vendorData.shop_name || activePersona.name;
        p_a_image = vendorData.profile_image || activePersona.avatar;
        p_a_type = 'vendor';
        p_a_table = 'vendor_profiles';
      }

      console.log("🟡 Active persona (p_a) details:", {
        p_a_id,
        p_a_name,
        p_a_type,
        p_a_table
      });

      // Determine p_b (target's Supabase ID)
      let p_b_id: string;
      let p_b_name: string;
      let p_b_image: string;
      let p_b_type: 'user' | 'vendor';
      let p_b_table: 'users' | 'vendor_profiles';
      let chat_type: 'user_user' | 'user_vendor' | 'vendor_vendor';

      if (targetType === 'user') {
        // Get user ID from users table
        const { data: targetUserData, error: targetUserError } = await supabase
          .from('users')
          .select('id, name, avatar_url, rooms, room_count')
          .eq('id', targetId)
          .maybeSingle();

        if (targetUserError) {
          console.error("❌ Error fetching target user data:", targetUserError);
          throw new Error(`Failed to fetch target user data: ${targetUserError.message}`);
        }

        if (!targetUserData) {
          console.error("❌ Target user not found in users table");
          throw new Error("Target user was not found in the database");
        }

        p_b_id = targetUserData.id;
        p_b_name = targetUserData.name || targetName;
        p_b_image = targetUserData.avatar_url || targetImage;
        p_b_type = 'user';
        p_b_table = 'users';
      } else {
        // Get vendor data from vendor_profiles table
        const { data: targetVendorData, error: targetVendorError } = await supabase
          .from('vendor_profiles')
          .select('id, shop_name, profile_image, rooms, room_count')
          .eq('id', targetId)
          .maybeSingle();

        if (targetVendorError) {
          console.error("❌ Error fetching target vendor data:", targetVendorError);
          throw new Error(`Failed to fetch target vendor data: ${targetVendorError.message}`);
        }

        if (!targetVendorData) {
          console.error("❌ Target vendor not found in vendor_profiles table");
          throw new Error("Target shop was not found in the database");
        }

        p_b_id = targetVendorData.id;
        p_b_name = targetVendorData.shop_name || targetName;
        p_b_image = targetVendorData.profile_image || targetImage;
        p_b_type = 'vendor';
        p_b_table = 'vendor_profiles';
      }

      console.log("🟡 Target (p_b) details:", {
        p_b_id,
        p_b_name,
        p_b_type,
        p_b_table
      });

      // Determine chat type based on participant types
      if (p_a_type === 'user' && p_b_type === 'user') {
        chat_type = 'user_user';
      } else if ((p_a_type === 'user' && p_b_type === 'vendor') || (p_a_type === 'vendor' && p_b_type === 'user')) {
        chat_type = 'user_vendor';
      } else if (p_a_type === 'vendor' && p_b_type === 'vendor') {
        chat_type = 'vendor_vendor';
      } else {
        chat_type = 'user_user'; // Default fallback
      }

      console.log("🟡 Final room configuration:", {
        p_a_id,
        p_a_name,
        p_b_id,
        p_b_name,
        chat_type
      });

      // Check if room already exists
      console.log("🟡 Checking for existing room...");
      
      const { data: existingRooms, error: existingRoomError } = await supabase
        .from('rooms')
        .select('id')
        .or(`and(p_a.eq.${p_a_id},p_b.eq.${p_b_id}),and(p_a.eq.${p_b_id},p_b.eq.${p_a_id})`);

      if (existingRoomError) {
        console.error("❌ Error checking existing room:", existingRoomError);
      }

      let roomId: string;
      
      if (existingRooms && existingRooms.length > 0) {
        roomId = existingRooms[0].id;
        console.log("🟡 Using existing room:", roomId);
        
        // Even for existing rooms, make sure both participants have it in their arrays
        const addedToA = await addRoomToParticipant(p_a_table, p_a_id, roomId);
        const addedToB = await addRoomToParticipant(p_b_table, p_b_id, roomId);
        
        if (!addedToA || !addedToB) {
          console.warn("⚠️ Failed to update participants for existing room");
        }
      } else {
        console.log("🟡 Creating new room...");
        
        // Create new room with participant info
        const { data: newRoomData, error: newRoomError } = await supabase
          .from('rooms')
          .insert({
            p_a: p_a_id,
            p_b: p_b_id,
            chat_type: chat_type,
            p_a_name: p_a_name,
            p_a_image: p_a_image,
            p_b_name: p_b_name,
            p_b_image: p_b_image,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_message_at: new Date().toISOString()
          })
          .select('id')
          .single();

        if (newRoomError) {
          console.error("❌ New room creation error:", newRoomError);
          throw newRoomError;
        }

        if (!newRoomData) {
          throw new Error("Failed to create room - no ID returned from database");
        }

        roomId = newRoomData.id;
        console.log("✅ New room created successfully with ID:", roomId);

        // CRITICAL: Add room ID to BOTH participants' rooms arrays BEFORE proceeding
        console.log("🟡 Adding room to participants' arrays...");
        
        const addedToA = await addRoomToParticipant(p_a_table, p_a_id, roomId);
        const addedToB = await addRoomToParticipant(p_b_table, p_b_id, roomId);
        
        if (!addedToA || !addedToB) {
          console.error("❌ Failed to add room to one or both participants");
          throw new Error("Failed to update participants with new room ID");
        }
        
        console.log("✅ Room successfully added to both participants");
      }

      // Refresh rooms list for the active persona
      console.log("🟡 Refreshing rooms list for active persona...");
      if (activePersona) {
        await fetchRoomsForPersona(activePersona);
      }
      
      return { success: true, roomId };
      
    } catch (error: any) {
      console.error('❌ Create room error:', error);
      
      let errorMessage = 'Failed to create chat room';
      if (error.code === 'PGRST116') {
        errorMessage = 'Database error: Could not find required user data';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return { success: false, error: errorMessage };
    } finally {
      setCreatingRoom(false);
    }
  };

  // Start new chat with found user/vendor
  const startChatWithId = async () => {
    if (!searchResults || !user || !activePersona) {
      console.log("❌ Missing required data for starting chat");
      alert("Please search for a user/shop first");
      return;
    }
    
    if (creatingRoom) {
      console.log("❌ Already creating a room, please wait");
      return;
    }
    
    try {
      console.log("🟡 Starting chat with search results:", searchResults);
      console.log("🟡 Active persona:", activePersona);
      
      // Create room with participant info
      const result = await createChatRoom(
        searchResults.id,
        searchResults.name,
        searchResults.avatar_url || '',
        searchResults.type
      );

      if (!result.success || !result.roomId) {
        console.log("❌ Room creation failed:", result.error);
        alert(result.error || 'Failed to create chat room');
        return;
      }

      const roomId = result.roomId;
      console.log("✅ Room created successfully, ID:", roomId);

      // Get sender ID for first message
      let senderId = '';
      if (activePersona.type === 'user') {
        const { data: userData } = await supabase
          .from('users')
          .select('id')
          .eq('firebase_uid', activePersona.firebase_uid || '')
          .maybeSingle();
        senderId = userData?.id || '';
      } else {
        // For vendor personas, we use the vendor ID directly
        senderId = activePersona.id;
      }

      // Send first message if we have a sender ID
      if (senderId) {
        try {
          const { error: messageError } = await supabase
            .from('messages')
            .insert({
              room_id: roomId,
              sender_id: senderId,
              message_text: `Hello ${searchResults.name}! 👋`,
              message_type: 'text',
              created_at: new Date().toISOString()
            });

          if (messageError) {
            console.error("❌ Error sending first message:", messageError);
          } else {
            console.log("✅ First message sent successfully");
          }
        } catch (messageError) {
          console.error("❌ Exception sending first message:", messageError);
        }
      }

      // Close new chat modal
      setShowNewChat(false);
      setSearchId("");
      setSearchResults(null);

      // Wait a moment for everything to settle, then redirect
      setTimeout(() => {
        console.log("🟡 Redirecting to chat room:", roomId);
        window.location.href = `/chat/${roomId}`;
      }, 800);

    } catch (error: any) {
      console.error('❌ Start chat error:', error);
      alert(error.message || 'Failed to start chat');
    }
  };

  // Handle persona switch
  const switchPersona = (persona: ChatPersona) => {
    console.log("🟡 Switching persona to:", persona);
    console.log("🟡 Previous persona:", activePersona);
    console.log("🟡 Current persona ID tracking:", currentPersonaId);
    
    // Clear rooms immediately to prevent showing wrong persona's rooms
    setRooms([]);
    setLoading(true);
    setActivePersona(persona);
    setShowPersonaMenu(false);
    
    // Fetch rooms for the new persona
    console.log("🟡 Fetching rooms for new persona...");
    fetchRoomsForPersona(persona);
  };

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (personaMenuRef.current && !personaMenuRef.current.contains(event.target as Node)) {
        setShowPersonaMenu(false);
      }
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Refetch rooms when sortBy changes (for current persona only)
  useEffect(() => {
    if (!initialLoadComplete || !activePersona || loading) {
      return;
    }
    
    console.log("🟡 useEffect for refetching rooms triggered (sortBy change)");
    console.log("🟡 Dependencies:", { 
      sortBy, 
      currentPersonaId,
      hasActivePersona: !!activePersona
    });
    
    if (activePersona && currentPersonaId === activePersona.id) {
      console.log("🟡 Refetching rooms due to sort change for persona:", activePersona.id);
      fetchRoomsForPersona(activePersona);
    }
  }, [sortBy, initialLoadComplete]);

  // Format name for display
  const formatName = (name: string) => {
    if (name.length > 15) {
      return name.substring(0, 13) + '...';
    }
    return name;
  };

  // Format UUID for display (show first 8 characters)
  const formatUuid = (uuid: string) => {
    if (!uuid) return '';
    if (uuid.length > 8) {
      return uuid.substring(0, 8) + '...';
    }
    return uuid;
  };

  // Filter rooms based on search - only filter rooms that are already loaded for current persona
  const filteredRooms = searchQuery 
    ? rooms.filter(room =>
        room.other_participant_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        room.last_message?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : rooms;

  if (loading && !initialLoadComplete) {
    return (
      <div className="chatlist-loading">
        <div className="chatlist-spinner"></div>
        <p>Loading chat list...</p>
      </div>
    );
  }

  console.log("🔵 Rendering main UI");
  console.log("🔵 Current active persona:", activePersona);
  console.log("🔵 Current persona ID tracking:", currentPersonaId);
  console.log("🔵 Rooms to display:", rooms.length);
  console.log("🔵 Loading state:", loading);
  console.log("🔵 Initial load complete:", initialLoadComplete);
  
  return (
    <div className="chatlist-container">
      {/* Top Header */}
      <div className="chatlist-top-header">
        <div className="chatlist-header-left">
          <div className="chatlist-persona-wrapper" ref={personaMenuRef}>
            <button 
              className="chatlist-persona-btn"
              onClick={() => {
                console.log("🟡 Persona menu button clicked");
                setShowPersonaMenu(!showPersonaMenu);
              }}
            >
              <div className="chatlist-persona-avatar">
                {activePersona?.avatar ? (
                  <img 
                    src={activePersona.avatar} 
                    alt={activePersona.name}
                    onError={(e) => {
                      console.log("🟡 Persona avatar error");
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : null}
                {!activePersona?.avatar && (
                  <div className="chatlist-persona-icon">
                    {activePersona?.type === 'vendor' ? <Building size={14} /> : <UserIcon size={14} />}
                  </div>
                )}
              </div>
              <span className="chatlist-persona-name">
                {formatName(activePersona?.name || 'Me')}
              </span>
              <ChevronDown size={12} />
            </button>
            
            {showPersonaMenu && (
              <div className="chatlist-persona-dropdown">
                <div className="chatlist-persona-list">
                  {personas.map((persona) => (
                    <div
                      key={persona.id}
                      className={`chatlist-persona-item ${activePersona?.id === persona.id ? 'active' : ''}`}
                      onClick={() => {
                        console.log("🟡 Persona clicked:", persona);
                        console.log("🟡 Persona type:", persona.type);
                        console.log("🟡 Persona shop_id:", persona.shop_id);
                        switchPersona(persona);
                      }}
                    >
                      <div className="chatlist-persona-item-avatar">
                        {persona.avatar ? (
                          <img 
                            src={persona.avatar} 
                            alt={persona.name}
                            onError={(e) => {
                              console.log("🟡 Persona item avatar error");
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : null}
                        {!persona.avatar && (
                          <div className="chatlist-persona-item-icon">
                            {persona.type === 'vendor' ? <Building size={12} /> : <UserIcon size={12} />}
                          </div>
                        )}
                      </div>
                      <span className="chatlist-persona-item-name">
                        {formatName(persona.name)}
                      </span>
                      {activePersona?.id === persona.id && (
                        <Check size={12} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="chatlist-header-center">
          <h1 className="chatlist-title">Messages</h1>
        </div>

        <div className="chatlist-header-right">
          <div className="chatlist-header-actions">

            
            <button 
              className="chatlist-action-btn"
              onClick={() => {
                console.log("🟡 Back button clicked");
                window.history.back();
              }}
              title="Go Back"
            >
              <ArrowLeft size={16} />
            </button>

            <button 
  className="chatlist-action-btn"
  onClick={() => navigate('/call-logs')}
  title="Call History"
>
  <PhoneCall size={16} />
</button>
            
            <div className="chatlist-settings-wrapper" ref={settingsMenuRef}>
              <button 
                className="chatlist-action-btn"
                onClick={() => {
                  console.log("🟡 Settings button clicked");
                  setShowSettings(!showSettings);
                }}
                title="Settings"
              >
                <Settings size={16} />
              </button>
              
              {showSettings && (
                <div className="chatlist-settings-dropdown">
                  <div className="chatlist-settings-list">
                    <div className="chatlist-settings-item">
                      <Settings size={14} />
                      <span>Settings</span>
                    </div>
                    <div className="chatlist-settings-item">
                      <UserIcon size={14} />
                      <span>Profile</span>
                    </div>
                    <div className="chatlist-settings-divider"></div>
                    <div className="chatlist-settings-item">
                      <span>Logout</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="chatlist-search-section">
        <button 
          className="chatlist-new-chat-btn"
          onClick={() => {
            console.log("🟡 New chat button clicked");
            setShowNewChat(!showNewChat);
          }}
        >
          <MessageCircle size={16} />
          <span>New</span>
        </button>

        <div className="chatlist-search-box">
          <Search size={14} />
          <input
            type="text"
            placeholder="Search rooms..."
            value={searchQuery}
            onChange={(e) => {
              console.log("🟡 Search query changed:", e.target.value);
              setSearchQuery(e.target.value);
            }}
            className="chatlist-search-input"
            ref={searchInputRef}
          />
          {searchQuery && (
            <button 
              className="chatlist-search-clear"
              onClick={() => {
                console.log("🟡 Clear search clicked");
                setSearchQuery("");
              }}
            >
              <X size={12} />
            </button>
          )}
        </div>

        <button 
          className={`chatlist-filter-btn ${sortBy === 'unread' ? 'active' : ''}`}
          onClick={() => {
            console.log("🟡 Filter button clicked, current sort:", sortBy);
            setSortBy(sortBy === 'recent' ? 'unread' : 'recent');
          }}
        >
          <Filter size={14} />
          <span>{sortBy === 'recent' ? 'Recent' : 'Unread'}</span>
        </button>
      </div>

      {/* New Chat Modal */}
      {showNewChat && (
        <div className="chatlist-newchat-overlay">
          <div className="chatlist-newchat-modal">
            <div className="chatlist-newchat-header">
              <h3>Start New Chat</h3>
              <button 
                className="chatlist-newchat-close"
                onClick={() => {
                  console.log("🟡 Close new chat modal");
                  setShowNewChat(false);
                  setSearchId("");
                  setSearchResults(null);
                }}
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="chatlist-newchat-body">
              {/* Active Persona Display */}
              <div className="chatlist-active-persona-display">
                <p className="chatlist-active-persona-label">You are starting chat as:</p>
                <div className="chatlist-active-persona-info">
                  <div className="chatlist-active-persona-avatar">
                    {activePersona?.avatar ? (
                      <img 
                        src={activePersona.avatar} 
                        alt={activePersona.name}
                        onError={(e) => {
                          console.log("🟡 Active persona avatar error in modal");
                          (e.target as HTMLImageElement).src = '/default-avatar.png';
                        }}
                      />
                    ) : (
                      <div className="chatlist-active-persona-icon">
                        {activePersona?.type === 'vendor' ? <Store size={16} /> : <UserIcon size={16} />}
                      </div>
                    )}
                  </div>
                  <div className="chatlist-active-persona-details">
                    <h4>{activePersona?.name || 'Unknown'}</h4>
                    <p>{activePersona?.type === 'vendor' ? 'Shop' : 'User'}</p>
                    <small className="chatlist-active-persona-id">
                      ID: {formatUuid(activePersona?.id || '')}
                    </small>
                  </div>
                </div>
              </div>

              <p>Enter User ID or Shop ID (UUID)</p>
              
              <div className="chatlist-id-search">
                <input
                  type="text"
                  placeholder="Enter UUID..."
                  value={searchId}
                  onChange={(e) => {
                    const value = e.target.value;
                    console.log("🟡 Search ID input changed:", value);
                    setSearchId(value);
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      console.log("🟡 Enter key pressed for search");
                      searchById();
                    }
                  }}
                />
                <button 
                  onClick={() => {
                    console.log("🟡 Search button clicked");
                    searchById();
                  }}
                  disabled={!searchId.trim() || searchLoading || creatingRoom}
                >
                  {searchLoading ? 'Searching...' : creatingRoom ? 'Creating Room...' : 'Search'}
                </button>
              </div>

              {/* Search Result Display */}
              {searchResults && (
                <div className="chatlist-search-result">
                  <div className="chatlist-search-result-label">
                    <p>Search Result:</p>
                  </div>
                  <div className="chatlist-search-result-info">
                    <div className="chatlist-result-avatar">
                      {searchResults.avatar_url ? (
                        <img 
                          src={searchResults.avatar_url} 
                          alt={searchResults.name}
                          onError={(e) => {
                            console.log("🟡 Search result avatar error");
                            (e.target as HTMLImageElement).src = '/default-avatar.png';
                          }}
                        />
                      ) : (
                        <div className="chatlist-result-icon">
                          {searchResults.type === 'vendor' ? <Store size={20} /> : <UserIcon size={20} />}
                        </div>
                      )}
                    </div>
                    <div className="chatlist-result-details">
                      <h4>{searchResults.name}</h4>
                      <p>{searchResults.type === 'vendor' ? 'Shop' : 'User'}</p>
                      <small className="chatlist-result-id">
                        ID: {formatUuid(searchResults.id)}
                      </small>
                    </div>
                    <button 
                      className="chatlist-start-btn"
                      onClick={() => {
                        console.log("🟡 Start chat button clicked");
                        startChatWithId();
                      }}
                      disabled={creatingRoom}
                    >
                      {creatingRoom ? 'Creating...' : 'Start Chat'}
                    </button>
                  </div>
                </div>
              )}

              {searchId && !searchResults && !searchLoading && (
                <div className="chatlist-no-result">
                  <p>No user or shop found with that ID</p>
                  <p className="chatlist-no-result-hint">
                    Searching automatically... If ID is valid, results will appear above.
                  </p>
                </div>
              )}

              {!searchId && !searchLoading && (
                <div className="chatlist-search-hint">
                  <p>🔍 Enter a valid UUID (36 characters)</p>
                  <p>• For users: Get ID from users table</p>
                  <p>• For shops: Get ID from vendor_profiles table</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rooms List - WhatsApp/Telegram Style */}
      <div className="chatlist-rooms-wrapper">
        {error ? (
          <div className="chatlist-error">
            <p>{error}</p>
            <button 
              onClick={() => {
                console.log("🟡 Error retry button clicked");
                if (activePersona) {
                  fetchRoomsForPersona(activePersona);
                }
              }}
            >
              Retry
            </button>
            <button 
              onClick={() => {
                console.log("🟡 Clear error button clicked");
                setError(null);
              }}
              style={{ marginLeft: '10px' }}
            >
              Dismiss
            </button>
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="chatlist-empty">
            <MessageCircle size={32} />
            <h3>No rooms for {activePersona?.name || 'current account'}</h3>
            <p>Start a new chat</p>
            <button 
              onClick={() => {
                console.log("🟡 Start chat from empty state");
                setShowNewChat(true);
              }}
            >
              Start Chat
            </button>
            <button 
              onClick={() => {
                console.log("🟡 Refresh from empty state");
                if (activePersona) {
                  fetchRoomsForPersona(activePersona);
                }
              }}
              style={{ marginTop: '10px' }}
            >
              Refresh
            </button>
            <div className="chatlist-empty-info">
              <p>Currently viewing rooms for: <strong>{activePersona?.name}</strong></p>
              <p>Type: <strong>{activePersona?.type === 'vendor' ? 'Shop' : 'User'}</strong></p>
              <p>Persona ID: <code>{formatUuid(activePersona?.id || '')}</code></p>
            </div>
          </div>
        ) : (
          <div className="chatlist-rooms-list">
            <div className="chatlist-rooms-header">
              <p>Rooms for: <strong>{activePersona?.name}</strong> ({activePersona?.type === 'vendor' ? 'Shop' : 'User'})</p>
              <p className="chatlist-rooms-count">{filteredRooms.length} rooms</p>
            </div>
            {filteredRooms.map((room) => {
              const lastAt = room.last_message_at ? parseISO(room.last_message_at) : null;
              const timeAgo = lastAt ? formatDistanceToNowStrict(lastAt, { addSuffix: true }) : "Now";
              const isUnread = (room.unread_count || 0) > 0;

              return (
                <div
                  key={room.room_id}
                  className={`chatlist-room-item ${isUnread ? 'unread' : ''}`}
                  onClick={() => {
                    console.log(`🟡 Room clicked: ${room.room_id}, Other: ${room.other_participant_name}`);
                    console.log(`🟡 Current persona: ${activePersona?.name} (${activePersona?.type})`);
                    window.location.href = `/chat/${room.room_id}`;
                  }}
                >
                  {/* Left: Participant Avatar - Shows OTHER participant, NOT active persona */}
                  <div className="chatlist-room-avatar">
                    {room.other_participant_avatar ? (
                      <img 
                        src={room.other_participant_avatar} 
                        alt={room.other_participant_name}
                        className="chatlist-room-avatar-img"
                        onError={(e) => {
                          console.log("🟡 Room avatar error");
                          (e.target as HTMLImageElement).src = '/default-avatar.png';
                        }}
                      />
                    ) : (
                      <div className="chatlist-room-avatar-default">
                        {room.other_participant_type === 'vendor' ? (
                          <Store size={20} className="chatlist-room-avatar-icon" />
                        ) : (
                          <UserIcon size={20} className="chatlist-room-avatar-icon" />
                        )}
                      </div>
                    )}
                    {isUnread && (
                      <span className="chatlist-room-unread-badge">
                        {room.unread_count}
                      </span>
                    )}
                  </div>

                  {/* Right: Room Info - Shows OTHER participant's details */}
                  <div className="chatlist-room-content">
                    {/* Top row: Name and Time */}
                    <div className="chatlist-room-header">
                      <div className="chatlist-room-name-wrapper">
                        <span className="chatlist-room-name">
                          {formatName(room.other_participant_name)}
                        </span>
                        {room.other_participant_type === 'vendor' && (
                          <span className="chatlist-room-type-badge">
                            <Store size={10} /> Shop
                          </span>
                        )}
                      </div>
                      <span className="chatlist-room-time">
                        {timeAgo}
                      </span>
                    </div>

                    {/* Bottom row: Last message */}
                    <div className="chatlist-room-last-message">
                      {room.last_message ? (
                        <div className="chatlist-room-message-preview">
                          <span className="chatlist-room-message-text">
                            {room.last_message.length > 30 
                              ? `${room.last_message.substring(0, 30)}...` 
                              : room.last_message}
                          </span>
                          {isUnread && !room.is_read && (
                            <div className="chatlist-room-unread-indicator"></div>
                          )}
                        </div>
                      ) : (
                        <span className="chatlist-room-no-messages">
                          No messages yet
                        </span>
                      )}
                    </div>

                    {/* Read status indicator */}
                    {room.is_read && !isUnread && (
                      <div className="chatlist-room-read-status">
                        <Check size={12} className="chatlist-room-read-icon" />
                        <span>Read</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

     
    </div>
  );
}
# 🧹 Cleanup Duplicate Wallets - Firebase Console Script

## Jika Anda Sudah Memiliki Duplikasi di Database

Jika duplikasi sudah terjadi sebelumnya, ikuti langkah berikut untuk membersihkan:

---

## Option 1: Manual Cleanup via Firebase Console (Recommended)

### Step 1: Buka Firebase Console
1. Login ke https://console.firebase.google.com
2. Pilih project: **YOUR_PROJECT_ID**
3. Sidebar → **Firestore Database**

### Step 2: Navigate ke Wallets Collection
```
Collection: artifacts/YOUR_PROJECT_ID/users/{userId}/wallets
```

**Cara:**
1. Klik collection `artifacts`
2. Klik document `YOUR_PROJECT_ID`
3. Klik sub-collection `users`
4. Klik document dengan UID Anda (email login Anda)
5. Klik sub-collection `wallets`

### Step 3: Identifikasi Duplikasi

Anda akan melihat list documents. Cek apakah ada duplikasi berdasarkan field `name`:

**Contoh Duplikasi:**
```
Document ID: abc123
  name: "Dompet Tunai"
  type: "cash"
  initialBalance: 0
  
Document ID: def456
  name: "Dompet Tunai"  ← DUPLICATE!
  type: "cash"
  initialBalance: 0
```

### Step 4: Hapus Duplikat

**PENTING: Simpan yang pertama, hapus yang duplikat!**

1. **Identifikasi** document mana yang akan dihapus (biasanya yang dibuat lebih baru)
2. **Klik** document duplikat
3. **Klik** icon **trash/delete** (atas kanan)
4. **Confirm** deletion

### Step 5: Verifikasi

Setelah cleanup:
- Logout dari aplikasi
- Login kembali
- Cek apakah wallet masih duplikat

---

## Option 2: Cleanup via Code (Advanced)

Jika Anda ingin cleanup programmatically, tambahkan fungsi sementara di App.jsx:

### Tambahkan Cleanup Function:

```javascript
// TEMPORARY: Add this function for one-time cleanup
const cleanupDuplicateWallets = async (userId) => {
  try {
    const walletsRef = collection(db, 'artifacts', appId, 'users', userId, 'wallets');
    const snapshot = await getDocs(walletsRef);
    
    const walletsByName = new Map();
    const duplicates = [];
    
    // Group by name
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const name = data.name;
      
      if (!walletsByName.has(name)) {
        walletsByName.set(name, doc);
      } else {
        // This is a duplicate
        duplicates.push(doc);
      }
    });
    
    // Delete duplicates
    console.log(`Found ${duplicates.length} duplicate wallets`);
    
    for (const duplicate of duplicates) {
      await deleteDoc(duplicate.ref);
      console.log(`Deleted duplicate: ${duplicate.data().name} (${duplicate.id})`);
    }
    
    console.log('✅ Cleanup completed!');
    return duplicates.length;
  } catch (error) {
    console.error('❌ Cleanup error:', error);
    return 0;
  }
};
```

### Panggil Function (sementara):

```javascript
// Di dalam useEffect setelah user login, add:
useEffect(() => {
  if (user) {
    // TEMPORARY: Run cleanup once
    const hasRunCleanup = localStorage.getItem('wallets_cleanup_done');
    if (!hasRunCleanup) {
      cleanupDuplicateWallets(user.uid).then(count => {
        if (count > 0) {
          alert(`Cleaned up ${count} duplicate wallets`);
        }
        localStorage.setItem('wallets_cleanup_done', 'true');
      });
    }
  }
}, [user]);
```

### Import yang Diperlukan:

```javascript
import { 
  getFirestore, collection, addDoc, query, where, onSnapshot, 
  deleteDoc, doc, orderBy, serverTimestamp, updateDoc, setDoc, getDocs  // ← Add getDocs
} from 'firebase/firestore';
```

### Setelah Cleanup:

1. **Remove** function `cleanupDuplicateWallets`
2. **Remove** cleanup useEffect
3. **Deploy** ulang tanpa cleanup code

---

## Option 3: Complete Database Reset (Nuclear Option)

**⚠️ WARNING: Ini akan menghapus SEMUA data Anda!**

### Step 1: Backup Data (Optional)
1. Firebase Console → Firestore Database
2. Export data (jika perlu)

### Step 2: Delete User Collection
```
1. Firebase Console → Firestore Database
2. Navigate ke: artifacts/{appId}/users/{userId}
3. Klik icon "..." (menu)
4. Pilih "Delete collection"
5. Confirm
```

### Step 3: Reload App
- Logout
- Login kembali
- Data akan di-initialize ulang (tanpa duplikat)

---

## Prevention (Already Implemented)

Code yang baru sudah memiliki **3 layer protection**:

### Layer 1: Initialization Flag with async/await
```javascript
if (data.length === 0 && !walletsInitialized.current) {
  walletsInitialized.current = true;
  await Promise.all(DEFAULT_WALLETS.map(w => addDoc(batchRef, w)));
}
```

### Layer 2: Deduplication on Read
```javascript
const uniqueWallets = [];
const seenNames = new Set();

for (const wallet of data) {
  if (!seenNames.has(wallet.name)) {
    seenNames.add(wallet.name);
    uniqueWallets.push(wallet);
  }
}
```

### Layer 3: Error Handling with Reset
```javascript
catch (error) {
  console.error('❌ Error initializing wallets:', error);
  walletsInitialized.current = false; // Reset flag on error
}
```

---

## Verification After Fix

### Test 1: Check Console Logs
Open DevTools Console, anda akan melihat:
```
✅ Wallets initialized
✅ Investment types initialized
✅ Categories initialized
```

Jika muncul warning:
```
⚠️ Duplicate wallet detected: Dompet Tunai abc123
```
Maka masih ada duplikasi di database yang perlu di-cleanup manual.

### Test 2: Count Documents
Di Firebase Console, count documents di collection `wallets`:
- **Expected:** 3 documents (Dompet Tunai, Bank BCA, Kartu Kredit Mandiri)
- **If more:** Ada duplikasi yang perlu dihapus

### Test 3: Logout & Login
1. Logout dari aplikasi
2. Clear browser cache (optional)
3. Login kembali
4. Cek apakah wallets tidak duplikat

---

## Troubleshooting

### Duplikasi Masih Muncul Setelah Update Code

**Cause:** Duplikasi sudah ada di database sebelum fix di-deploy

**Solution:**
1. Run manual cleanup (Option 1)
2. Atau gunakan cleanup script (Option 2)
3. Deploy code fix terbaru
4. Test dengan user baru

### Cleanup Script Tidak Jalan

**Possible Issues:**
- getDocs import belum ditambahkan
- Function tidak dipanggil di useEffect
- Error di console (check DevTools)

**Solution:**
- Verify imports
- Check console errors
- Use manual cleanup instead

### Error: "Permission Denied"

**Cause:** Firestore rules tidak allow delete

**Temporary Solution:**
Edit Firestore Rules untuk allow delete:
```javascript
match /users/{userId}/{document=**} {
  allow read, write, delete: if request.auth.uid == userId;
}
```

---

## Support

Jika masih ada issue:
1. Screenshot di Firebase Console → Firestore → wallets collection
2. Copy console logs (DevTools)
3. Report via GitHub issues atau email

---

**Status:** ✅ Code fix deployed (async/await + deduplication)  
**Next:** Manual cleanup duplikasi yang sudah ada di database

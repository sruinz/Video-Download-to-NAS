# Manual Testing Guide for File Rename Functionality

## Test Cases

### 1. Valid Filename Change
**Steps:**
1. Login to the application
2. Navigate to the library
3. Click the rename button (pencil icon) on any file
4. Enter a new valid filename (e.g., "my_new_video")
5. Click Confirm

**Expected Result:**
- File is renamed successfully
- Success toast appears
- File list refreshes with new filename
- File extension is preserved automatically

### 2. Empty Filename
**Steps:**
1. Click rename button on a file
2. Clear the input field or enter only spaces
3. Try to confirm

**Expected Result:**
- Confirm button is disabled
- Error message: "Filename cannot be empty"

### 3. Invalid Characters
**Steps:**
1. Click rename button on a file
2. Try entering filenames with invalid characters:
   - `../../../etc/passwd` (path traversal)
   - `test/file` (forward slash)
   - `test\file` (backslash)
   - `test<file>` (angle brackets)
   - `test"file"` (quotes)
   - `test|file` (pipe)

**Expected Result:**
- Error message: "Invalid filename"
- Cannot submit the form

### 4. File Extension Preservation
**Steps:**
1. Click rename button on a video file (e.g., "video.mp4")
2. Enter new name without extension (e.g., "my_video")
3. Confirm

**Expected Result:**
- File is renamed to "my_video.mp4"
- Extension is automatically added

### 5. Duplicate Filename
**Steps:**
1. Note an existing filename in your library
2. Try to rename another file to that exact name
3. Confirm

**Expected Result:**
- Error toast: "A file with this name already exists"
- Rename fails

### 6. Permission Check
**Steps:**
1. Try to rename a file that belongs to another user (if possible)

**Expected Result:**
- Error: "File not found" (404)
- Cannot rename files owned by other users

### 7. Long Filename
**Steps:**
1. Click rename button
2. Enter a very long filename (>200 characters)
3. Try to confirm

**Expected Result:**
- Error message: "Filename is too long"
- Cannot submit

### 8. Special Characters (Valid)
**Steps:**
1. Click rename button
2. Enter filename with valid special characters:
   - `my-video_2024` (hyphens, underscores, numbers)
   - `영상 파일` (Korean characters)
   - `视频文件` (Chinese characters)

**Expected Result:**
- File is renamed successfully
- Special characters are preserved

## API Testing (Optional)

### Using curl:

```bash
# Get auth token first
TOKEN="your_jwt_token_here"

# Test valid rename
curl -X PATCH "http://localhost:8000/api/file/1/rename" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"new_filename": "renamed_video.mp4"}'

# Test empty filename
curl -X PATCH "http://localhost:8000/api/file/1/rename" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"new_filename": "   "}'

# Test path traversal
curl -X PATCH "http://localhost:8000/api/file/1/rename" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"new_filename": "../../../etc/passwd"}'

# Test invalid characters
curl -X PATCH "http://localhost:8000/api/file/1/rename" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"new_filename": "test<file>.mp4"}'
```

## Checklist

- [ ] Valid filename changes work
- [ ] Empty filenames are rejected
- [ ] Path traversal attempts are blocked
- [ ] Invalid characters are rejected
- [ ] File extensions are preserved
- [ ] Duplicate filenames are detected
- [ ] Permission checks work (users can only rename their own files)
- [ ] Long filenames are rejected
- [ ] UI shows appropriate error messages
- [ ] Success toast appears on successful rename
- [ ] File list refreshes after rename

## Notes

- The backend validates filenames using regex to remove invalid characters
- Path traversal is prevented by checking for `..`, `/`, and `\`
- File extension is automatically preserved from the original filename
- Database is updated with the new relative path
- Physical file on disk is renamed using Python's `Path.rename()`

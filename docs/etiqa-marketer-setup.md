# 📖 Etiqa Takaful Marketer: n8n Setup Guide

This guide explains how to import, configure, and run the **Etiqa Takaful Social Marketer** workflow inside your n8n instance using Google Drive (for data storage) and the Google Gemini API (for AI copywriting).

---

## 🚀 Step 1: Import the Workflow JSON
1. Open your OCI **n8n Web Interface** in your browser.
2. Go to **Workflows** (left sidebar) and click **Add Workflow** (top-right).
3. Click the **three dots menu** in the top-right corner of the empty workflow canvas.
4. Select **Import from File**.
5. Select the **`etiqa-marketer.json`** file from your workspace:
   `agentic-ai-workspace/workflows/hafeez_bot/takaful/etiqa-marketer.json`

---

## 📁 Step 2: Configure Google Drive Nodes
The workflow uses Google Drive to read your brand guidelines and product brochures in the cloud.

1. Double-click the **Read Brand Voice Guide** node.
2. Under **Credential for Google Drive OAuth2 API**, click **Create New Credential** and authenticate it with your Google Account.
3. Under **File ID**, paste the unique ID of your `Brand_Voice_Guide.txt` file. 
   *(To get the File ID: Right-click the file in Google Drive -> click **Copy link**. The ID is the long string of letters and numbers in the URL between `/d/` and `/view`).*
4. Do the same for the **Read Product Brochure PDF** node, pasting the File ID of your `Eliteplus Takafulink` PDF.

---

## 🔑 Step 3: Link your Gemini API Key
1. Double-click the **Google Gemini** chat model node at the bottom of the canvas.
2. Under **Credential for Google API**, click **Create New Credential**.
3. Paste the **API Key** you generated from [Google AI Studio](https://aistudio.google.com/).
4. Verify the model is set to **`gemini-1.5-pro`** (essential for handling large PDF files).

---

## 🎯 Step 4: Run the Agent
1. Click **Execute Workflow** at the bottom of the canvas.
2. The workflow will:
   - Download the brand guidelines and brochure PDF from Google Drive.
   - Send them to Gemini Pro with your custom system prompt.
   - Generate a high-converting, Alex Hormozi-style social media post.
3. View the generated post in the **AI Agent** node execution logs.

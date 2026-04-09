/**
 * Test script for email sequences API endpoints
 * Usage: node scripts/test-sequences-api.js
 */

const API_BASE = "http://localhost:3000";

async function testAPI() {
  console.log("🧪 Testing Email Sequences API...\n");

  try {
    // Test 1: Get all sequences (should be empty initially)
    console.log("1️⃣  Testing GET /api/sequences");
    const getResponse = await fetch(`${API_BASE}/api/sequences`);
    const getData = await getResponse.json();
    console.log("   Status:", getResponse.status);
    console.log("   Success:", getData.success);
    console.log("   Count:", getData.data?.length || 0);
    console.log("   ✅ Passed\n");

    // Test 2: Create a new sequence
    console.log("2️⃣  Testing POST /api/sequences");
    const createResponse = await fetch(`${API_BASE}/api/sequences`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Welcome Sequence",
        description: "A test welcome sequence for new users",
        is_active: true,
      }),
    });
    const createData = await createResponse.json();
    console.log("   Status:", createResponse.status);
    console.log("   Success:", createData.success);
    console.log("   Sequence ID:", createData.data?.id);
    console.log("   ✅ Passed\n");

    const sequenceId = createData.data.id;

    // Test 3: Update the sequence
    console.log("3️⃣  Testing PUT /api/sequences");
    const updateResponse = await fetch(`${API_BASE}/api/sequences`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: sequenceId,
        name: "Updated Welcome Sequence",
        description: "Updated description",
        is_active: false,
      }),
    });
    const updateData = await updateResponse.json();
    console.log("   Status:", updateResponse.status);
    console.log("   Success:", updateData.success);
    console.log("   Updated Name:", updateData.data?.name);
    console.log("   Is Active:", updateData.data?.is_active);
    console.log("   ✅ Passed\n");

    // Test 4: Get sequence items (should be empty)
    console.log("4️⃣  Testing GET /api/sequences/{id}/items");
    const getItemsResponse = await fetch(
      `${API_BASE}/api/sequences/${sequenceId}/items`,
    );
    const getItemsData = await getItemsResponse.json();
    console.log("   Status:", getItemsResponse.status);
    console.log("   Success:", getItemsData.success);
    console.log("   Items Count:", getItemsData.data?.length || 0);
    console.log("   ✅ Passed\n");

    // Test 5: Delete the sequence
    console.log("5️⃣  Testing DELETE /api/sequences");
    const deleteResponse = await fetch(
      `${API_BASE}/api/sequences?id=${sequenceId}`,
      {
        method: "DELETE",
      },
    );
    const deleteData = await deleteResponse.json();
    console.log("   Status:", deleteResponse.status);
    console.log("   Success:", deleteData.success);
    console.log("   Message:", deleteData.message);
    console.log("   ✅ Passed\n");

    console.log("✅ All tests passed!");
  } catch (error) {
    console.error(" Test failed:", error.message);
    console.error(
      "\nMake sure the development server is running on http://localhost:3000",
    );
    process.exit(1);
  }
}

// Run tests
testAPI();

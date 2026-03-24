<?php
header('Content-Type: application/json');

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

// Read JSON body
$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid request body']);
    exit;
}

$to = 'info@ie-gf.org';
$formType = isset($input['form_type']) ? $input['form_type'] : 'unknown';

// Sanitise all input values
$data = array_map(function ($val) {
    return htmlspecialchars(strip_tags(trim($val)), ENT_QUOTES, 'UTF-8');
}, $input);

// Build subject line based on form type
$subjects = [
    'contact'    => 'New Contact Message',
    'register'   => 'New Registration',
    'partner'    => 'New Partnership Inquiry',
    'gic'        => 'New GIC Application',
    'subscribe'  => 'New Newsletter Subscriber',
    'notify'     => 'New Launch Notification Request',
];
$subject = 'IEGF Website: ' . (isset($subjects[$formType]) ? $subjects[$formType] : 'New Form Submission');

// Build email body
$body = "Form: " . ucfirst($formType) . "\n";
$body .= "Submitted: " . date('Y-m-d H:i:s') . "\n";
$body .= str_repeat('-', 40) . "\n\n";

// Map readable labels
$labels = [
    'form_type'     => null, // skip
    'name'          => 'Name',
    'email'         => 'Email',
    'subject'       => 'Subject',
    'message'       => 'Message',
    'type'          => 'Registration Type',
    'organisation'  => 'Organisation',
    'contact'       => 'Contact Person',
    'location'      => 'Community/Location',
];

foreach ($data as $key => $value) {
    if ($key === 'form_type') continue;
    $label = isset($labels[$key]) ? $labels[$key] : ucfirst(str_replace('_', ' ', $key));
    $body .= $label . ": " . $value . "\n";
}

// Reply-to the sender if they provided an email
$replyTo = isset($data['email']) && filter_var($data['email'], FILTER_VALIDATE_EMAIL)
    ? $data['email']
    : $to;

$headers  = "From: IEGF Website <noreply@ie-gf.org>\r\n";
$headers .= "Reply-To: " . $replyTo . "\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

// Send
$sent = mail($to, $subject, $body, $headers);

if ($sent) {
    echo json_encode(['success' => true, 'message' => 'Your message has been sent successfully.']);
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to send message. Please try again later.']);
}

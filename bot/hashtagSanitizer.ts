export function sanitizeHashtag(subject: string): string {
    // Remove any non-alphanumeric characters, except for underscores
    let sanitized = subject.replace(/[^\w\s]/g, '');
    
    // Replace spaces with empty string
    sanitized = sanitized.replace(/\s+/g, '');
    
    // Capitalize the first letter of each word (camelCase)
    sanitized = sanitized.replace(/(?:^\w|[A-Z]|\b\w)/g, (letter, index) => {
        return index === 0 ? letter.toLowerCase() : letter.toUpperCase();
    }).replace(/\s+/g, '');

    // Ensure the hashtag doesn't start with a number
    if (/^\d/.test(sanitized)) {
        sanitized = 'tag' + sanitized;
    }

    return sanitized;
}
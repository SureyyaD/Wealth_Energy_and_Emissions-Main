import axios from "axios";

interface RandomNumberResponse {
    randomNumber: number; // Match the API's JSON structure
}


/**
 * Extracts a readable message from an unknown error object.
 * @param error - The error object to process.
 * @returns A string describing the error.
 */
export const getErrorMessage = (error: unknown): string => {
    if (axios.isAxiosError(error)) {
        return error.response?.data?.message || error.message || 'An Axios error occurred.';
    }
    if (error instanceof Error) {
        return error.message;
    }
    return 'An unknown error occurred.';
};

/**
 * Test function to get a random number
 * @returns A promise to a random number <RandomNumberResponse>
 */
export const getRandomNumber = async (): Promise<RandomNumberResponse> => {
    try {
        // Perform the API request
        const response = await axios.get<RandomNumberResponse>('/api/random-number');

        // Extract and return the response data
        return response.data;
    } catch (error: unknown) {
        // Handle errors and rethrow for calling code to handle if needed
        if (axios.isAxiosError(error)) {
            throw new Error(`Axios error: ${error.response?.data?.message || error.message}`);
        } else {
            throw new Error('An unknown error occurred');
        }
    }
};
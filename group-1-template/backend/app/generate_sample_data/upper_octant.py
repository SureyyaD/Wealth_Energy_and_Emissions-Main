"""
Function to generate 3D points for the frontend to test the 3D scatterplot
"""
import numpy as np


def fibonacci_sphere():
    # Number of points to create the illusion of a spherical shape

    num_points_on_sphere = 640  # Example number of points (comes out to 80 since we divide by 8 for the octant )

    golden_angle = np.pi * (3 - np.sqrt(5))  # Golden angle in radians

    # Calculate the points using the Fibonacci sphere algorithm

    sphere_points = []

    for i in range(num_points_on_sphere):
        z = 1 - (i / float(num_points_on_sphere - 1)) * 2  # z goes from 1 to -1

        radius = np.sqrt(1 - z * z)  # The radius at z

        theta = golden_angle * i  # The golden angle increment

        x = np.cos(theta) * radius * 10

        y = np.sin(theta) * radius * 10

        z *= 10

        sphere_points.append((x, y, z))

    # We will filter out the points that are only in the upper octant (x >= 0, y >= 0, z >= 0)
    upper_octant_points = [(x, y, z) for x, y, z in sphere_points if x >= 0 and y >= 0 and z >= 0]

    # Convert to a numpy array for easier handling
    return upper_octant_points


def linear_approx_sphere():
    radius = 10
    num_points = 10

    y_step = radius / (num_points - 1)

    # Calculate the original circumference of the quarter circle at y=0
    original_circumference = np.pi * radius / 2  # quarter of the full circumference

    # Initialize a list to hold all the points for different layers
    all_layers_points = []

    # Calculate points for each layer, reducing the number of points for each subsequent layer
    for y_step_index in range(num_points):
        # Calculate the y-coordinate for this layer
        y_coord = y_step * y_step_index

        # Calculate the new radius at this y-coordinate
        new_radius = np.sqrt(radius ** 2 - y_coord ** 2)

        # Determine the new circumference
        new_circumference = np.pi * new_radius / 2

        # Calculate the ratio of the new circumference to the original
        ratio = new_circumference / original_circumference

        # Determine the number of points for this layer (must be at least 2 to form a line)
        layer_num_points = max(2, int(np.ceil(ratio * num_points)))

        # Calculate the angle increment for this layer's points
        layer_angle_increment = np.pi / 2 / (layer_num_points - 1)

        # Calculate the points for this layer
        layer_points = [
            (new_radius * np.cos(i * layer_angle_increment), y_coord, new_radius * np.sin(i * layer_angle_increment))
            for i in range(layer_num_points)]

        # Add this layer's points to the list of all points
        all_layers_points.extend(layer_points)

    # Convert to a numpy array for easier handling
    return all_layers_points


if __name__ == "__main__":
    # points = linear_approx()
    points = fibonacci_sphere()

    # Generate the string to represent points with THREE.Vector3
    vector3_points_str = ",\n".join(["new THREE.Vector3({:.3f}, {:.3f}, {:.3f})".format(x, y, z)
                                     for x, y, z in points])
    # print(vector3_points_str)

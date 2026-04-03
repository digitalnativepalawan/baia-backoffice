import React from 'react';
import { useState } from 'react';

const NonFoodInventory = () => {
    const [formData, setFormData] = useState({
        category_id: '',
        // other form data 
    });
    const categories = [
        // assuming categories are fetched somehow 
        { id: 1, name: 'Category 1', department: 'Department 1' },
        { id: 2, name: 'Category 2', department: 'Department 2' }
        // more categories 
    ];

    const handleCategoryChange = (event) => {
        setFormData({
            ...formData,
            category_id: event.target.value,
        });
    };

    return (
        <form>
            {/* other form elements */}
            <label htmlFor="category">Category</label>
            <select
                id="category"
                value={formData.category_id}
                onChange={handleCategoryChange}
            >
                <option value="" disabled>Select a category</option>
                {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                        {`${category.name} - ${category.department}`}
                    </option>
                ))}
            </select>
            {/* other form elements */}
        </form>
    );
};

export default NonFoodInventory;
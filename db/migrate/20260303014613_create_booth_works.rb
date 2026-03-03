class CreateBoothWorks < ActiveRecord::Migration[8.1]
  def change
    create_table :booth_works do |t|
      t.references :booth, null: false, foreign_key: true
      t.string :title
      t.string :circle
      t.integer :price
      t.boolean :new
      t.integer :limit
      t.integer :num_to_buy
      t.integer :num_bought
      t.text :notes

      t.timestamps
    end
  end
end

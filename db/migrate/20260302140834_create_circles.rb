class CreateCircles < ActiveRecord::Migration[8.1]
  def change
    create_table :circles do |t|
      t.string :name
      t.string :name_reading
      t.text :description
      t.text :notes

      t.timestamps
    end
  end
end
